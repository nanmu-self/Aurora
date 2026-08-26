//! 文件变更监听（§4.6-B「Watch Storm」三层防御）：
//!
//! 1. Rust 侧防抖：同一路径的连续事件在窗口期内只转发一次；
//! 2. 自写抑制队列：应用自身写入前后登记路径，窗口期内的 watcher 事件直接丢弃；
//! 3. 兜底在前端：重载前比对磁盘内容与内存文档，一致则静默忽略（tabs.reloadTab）。
//!
//! 监听策略 v1：仅监听工作区根（递归）。工作区外的单文件暂不监听。

use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::sync::{mpsc, Mutex, OnceLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Emitter};

/// 自写抑制窗口：写入后该时长内的 watcher 事件视为自身产生
const SELF_WRITE_WINDOW_MS: u64 = 800;
/// 同一路径事件转发的最小间隔
const DEBOUNCE_MS: u64 = 400;

struct WatchState {
    tx: mpsc::Sender<Result<Event, notify::Error>>,
    watchers: Vec<RecommendedWatcher>,
    /// path → 抑制截止时间（毫秒时间戳）
    self_writes: HashMap<String, u64>,
    /// path → 上次转发时间（毫秒时间戳）
    last_emit: HashMap<String, u64>,
}

static STATE: OnceLock<Mutex<WatchState>> = OnceLock::new();
static APP: OnceLock<AppHandle> = OnceLock::new();

fn state() -> &'static Mutex<WatchState> {
    STATE.get_or_init(|| {
        // 事件消费线程随状态一起创建；APP 句柄稍后注入，
        // 注入前到达的事件因取不到句柄而被丢弃（此时尚无任何 watcher，安全）。
        let (tx, rx) = mpsc::channel::<Result<Event, notify::Error>>();
        std::thread::spawn(move || {
            while let Ok(msg) = rx.recv() {
                if let Ok(event) = msg {
                    handle_event(event);
                }
            }
        });
        Mutex::new(WatchState {
            tx,
            watchers: Vec::new(),
            self_writes: HashMap::new(),
            last_emit: HashMap::new(),
        })
    })
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_millis() as u64
}

fn handle_event(event: Event) {
    let app = match APP.get() {
        Some(a) => a,
        None => return,
    };
    let mut st = state().lock().unwrap();
    let now = now_ms();
    for path in event.paths {
        let key = path.to_string_lossy().to_string();
        // 第 2 层：自写抑制
        if let Some(&expiry) = st.self_writes.get(&key) {
            if now < expiry {
                continue;
            }
            st.self_writes.remove(&key);
        }
        // 第 1 层：防抖聚合
        if let Some(&last) = st.last_emit.get(&key) {
            if now.saturating_sub(last) < DEBOUNCE_MS {
                continue;
            }
        }
        st.last_emit.insert(key.clone(), now);
        let _ = app.emit("fs-changed", serde_json::json!({ "path": key }));
    }
}

/// 应用自身的写操作完成后调用，登记抑制窗口。
pub fn mark_self_write(path: &str) {
    let mut st = state().lock().unwrap();
    st.self_writes
        .insert(path.to_string(), now_ms() + SELF_WRITE_WINDOW_MS);
}

/// 监听目录（递归）。同一时间只保留最新一个工作区的监听，换工作区时丢弃旧的。
#[tauri::command]
pub fn watch_workspace(app: AppHandle, dir: String) -> Result<(), String> {
    let _ = APP.set(app);

    let mut st = state().lock().unwrap();
    let tx = st.tx.clone();

    st.watchers.clear();
    let mut watcher =
        notify::recommended_watcher(tx).map_err(|e| format!("创建监听器失败：{e}"))?;
    watcher
        .watch(std::path::Path::new(&dir), RecursiveMode::Recursive)
        .map_err(|e| format!("监听失败：{e}"))?;
    st.watchers.push(watcher); // 存活即持续产生事件，drop 即停止
    Ok(())
}

/// 取消全部监听（关闭工作区时）。
#[tauri::command]
pub fn unwatch_all() -> Result<(), String> {
    let mut st = state().lock().unwrap();
    st.watchers.clear();
    st.self_writes.clear();
    st.last_emit.clear();
    Ok(())
}
