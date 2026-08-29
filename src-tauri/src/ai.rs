//! AI 请求代理（OpenAI 兼容协议）。
//!
//! 设计要点：
//! - WebView 直接 fetch 调公共 AI 接口会受 CORS 限制，且 API key 会被暴露在
//!   渲染层 —— 因此按「所有 IO 走 Rust command」的项目原则，在 Rust 侧代理；
//! - 流式回复经 Tauri 2 的 `Channel` 逐段推给前端，最终返回完整文本；
//! - 错误统一 `String`，与 fs.rs 等现有命令保持一致；
//! - 取消：ai_chat 期间在全局状态持有取消标记，ai_cancel 置位后流循环退出。

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use tauri::ipc::Channel;
use tauri::State;

/// 取消标记：ai_chat 开始时置入，ai_cancel 置位，结束后清空。
pub struct AiCancelFlag(Mutex<Option<Arc<AtomicBool>>>);

/// 用户在设置中配置的 AI 服务信息（通用 OpenAI 兼容协议）。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiConfig {
    /// 例如 https://api.openai.com/v1
    pub base_url: String,
    pub api_key: String,
    pub model: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize)]
struct ChatPayload<'a> {
    model: &'a str,
    messages: &'a [ChatMessage],
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
}

#[derive(Serialize)]
struct TestPayload<'a> {
    model: &'a str,
    messages: [ChatMessage; 1],
    max_tokens: u32,
}

/// 前端据此区分「用户主动停止」与真实错误。
pub const CANCELLED_MSG: &str = "__AURORA_CANCELLED__";

/// 规整 base url：去掉尾部斜杠（用户常多粘贴一个 /）。
fn normalize_base(base: &str) -> String {
    base.trim().trim_end_matches('/').to_string()
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(300))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败：{e}"))
}

async fn post_chat(
    config: &AiConfig,
    payload: &serde_json::Value,
) -> Result<reqwest::Response, String> {
    if config.base_url.trim().is_empty() || config.model.trim().is_empty() {
        return Err("请先在设置中配置 AI 服务的 Base URL 和模型".to_string());
    }
    let url = format!("{}/chat/completions", normalize_base(&config.base_url));
    let resp = client()?
        .post(&url)
        .bearer_auth(config.api_key.trim())
        .json(payload)
        .send()
        .await
        .map_err(|e| format!("请求失败：{e}"))?;
    let status = resp.status();
    if !status.is_success() {
        let body = resp.text().await.unwrap_or_default();
        // 截断过长的错误响应，避免状态栏/面板被刷爆
        let body = body.chars().take(400).collect::<String>();
        return Err(format!("HTTP {status}：{body}"));
    }
    Ok(resp)
}

fn extract_delta_content(value: &serde_json::Value) -> Option<String> {
    value
        .pointer("/choices/0/delta/content")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
}

/// 流式对话：SSE 逐 delta 经 channel 推给前端，返回累积全文。
#[tauri::command]
pub async fn ai_chat(
    state: State<'_, AiCancelFlag>,
    config: AiConfig,
    messages: Vec<ChatMessage>,
    on_delta: Channel<String>,
) -> Result<String, String> {
    let flag = Arc::new(AtomicBool::new(false));
    if let Ok(mut slot) = state.0.lock() {
        *slot = Some(flag.clone());
    }

    let result = chat_stream(&config, &messages, &on_delta, &flag).await;

    if let Ok(mut slot) = state.0.lock() {
        *slot = None;
    }
    result
}

async fn chat_stream(
    config: &AiConfig,
    messages: &[ChatMessage],
    on_delta: &Channel<String>,
    flag: &AtomicBool,
) -> Result<String, String> {
    let payload = serde_json::to_value(ChatPayload {
        model: &config.model,
        messages,
        stream: true,
        max_tokens: None,
    })
    .map_err(|e| e.to_string())?;

    let resp = post_chat(config, &payload).await?;
    let mut stream = resp.bytes_stream();
    let mut buf = String::new();
    let mut full = String::new();

    while let Some(chunk) = stream.next().await {
        if flag.load(Ordering::Relaxed) {
            return Err(CANCELLED_MSG.to_string());
        }
        let bytes = chunk.map_err(|e| format!("接收数据中断：{e}"))?;
        buf.push_str(&String::from_utf8_lossy(&bytes));

        while let Some(pos) = buf.find('\n') {
            let line: String = buf.drain(..=pos).collect();
            let line = line.trim();
            let Some(data) = line.strip_prefix("data:") else {
                continue;
            };
            let data = data.trim();
            if data == "[DONE]" {
                return Ok(full);
            }
            if data.is_empty() {
                continue;
            }
            if let Ok(value) = serde_json::from_str::<serde_json::Value>(data) {
                if let Some(delta) = extract_delta_content(&value) {
                    full.push_str(&delta);
                    // 前端只消费，发送失败不致命
                    let _ = on_delta.send(delta);
                }
            }
        }
    }
    Ok(full)
}

/// 非流式最小请求（max_tokens=1），用于设置页「测试连接」。
#[tauri::command]
pub async fn ai_test(config: AiConfig) -> Result<String, String> {
    let payload = TestPayload {
        model: &config.model,
        messages: [ChatMessage {
            role: "user".to_string(),
            content: "hi".to_string(),
        }],
        max_tokens: 1,
    };
    let value = serde_json::to_value(&payload).map_err(|e| e.to_string())?;
    let resp = post_chat(&config, &value).await?;
    let json: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("响应解析失败：{e}"))?;
    Ok(json
        .pointer("/choices/0/message/content")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string())
}

/// 中止进行中的 ai_chat。
#[tauri::command]
pub fn ai_cancel(state: State<'_, AiCancelFlag>) {
    if let Ok(slot) = state.0.lock() {
        if let Some(flag) = slot.as_ref() {
            flag.store(true, Ordering::Relaxed);
        }
    }
}

/// 取消标记的初始值，lib.rs setup 时 manage。
pub fn initial_cancel_flag() -> AiCancelFlag {
    AiCancelFlag(Mutex::new(None))
}
