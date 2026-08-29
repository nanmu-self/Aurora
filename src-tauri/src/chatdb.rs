//! 聊天记录持久化（SQLite，rusqlite bundled）。
//!
//! - 库文件位于应用数据目录 `chat.db`，setup 时建立并 manage；
//! - 连接用 Mutex 包裹（rusqlite Connection 非 Sync），命令均为快速同步操作；
//! - 前端在每条消息完成后逐条落库（用户消息先存、AI 回复流式结束再存），
//!   中途崩溃最多丢最后一条未完成的回复。

use std::sync::Mutex;

use rusqlite::{params, Connection};
use serde::Serialize;
use tauri::State;

pub struct ChatDb(Mutex<Connection>);

impl ChatDb {
    /// setup 时由 lib.rs 构造并 manage
    pub fn new(conn: Connection) -> Self {
        ChatDb(Mutex::new(conn))
    }
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// 建库建表（幂等）。暴露给 lib.rs 在 setup 中调用。
pub fn init_db(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;
         CREATE TABLE IF NOT EXISTS sessions (
             id         TEXT PRIMARY KEY,
             title      TEXT NOT NULL,
             created_at INTEGER NOT NULL,
             updated_at INTEGER NOT NULL
         );
         CREATE TABLE IF NOT EXISTS messages (
             id         INTEGER PRIMARY KEY AUTOINCREMENT,
             session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
             role       TEXT NOT NULL,
             content    TEXT NOT NULL,
             quote      TEXT,
             created_at INTEGER NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, id);",
    )
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionRow {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub message_count: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageRow {
    pub role: String,
    pub content: String,
    pub quote: Option<String>,
    pub created_at: i64,
}

fn db_err(e: rusqlite::Error) -> String {
    format!("聊天记录读写失败：{e}")
}

#[tauri::command]
pub fn chat_create_session(db: State<'_, ChatDb>, title: String) -> Result<SessionRow, String> {
    let conn = db.0.lock().map_err(|_| "数据库被占用".to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = now_ms();
    conn.execute(
        "INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)",
        params![id, title, now],
    )
    .map_err(db_err)?;
    Ok(SessionRow {
        id,
        title,
        created_at: now,
        updated_at: now,
        message_count: 0,
    })
}

#[tauri::command]
pub fn chat_append_message(
    db: State<'_, ChatDb>,
    session_id: String,
    role: String,
    content: String,
    quote: Option<String>,
) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "数据库被占用".to_string())?;
    let now = now_ms();
    conn.execute(
        "INSERT INTO messages (session_id, role, content, quote, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![session_id, role, content, quote, now],
    )
    .map_err(db_err)?;
    conn.execute(
        "UPDATE sessions SET updated_at = ?1 WHERE id = ?2",
        params![now, session_id],
    )
    .map_err(db_err)?;
    Ok(())
}

#[tauri::command]
pub fn chat_list_sessions(db: State<'_, ChatDb>) -> Result<Vec<SessionRow>, String> {
    let conn = db.0.lock().map_err(|_| "数据库被占用".to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT s.id, s.title, s.created_at, s.updated_at,
                    (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) AS cnt
             FROM sessions s
             ORDER BY s.updated_at DESC
             LIMIT 200",
        )
        .map_err(db_err)?;
    let rows = stmt
        .query_map([], |r| {
            Ok(SessionRow {
                id: r.get(0)?,
                title: r.get(1)?,
                created_at: r.get(2)?,
                updated_at: r.get(3)?,
                message_count: r.get(4)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(rows)
}

#[tauri::command]
pub fn chat_get_messages(db: State<'_, ChatDb>, session_id: String) -> Result<Vec<MessageRow>, String> {
    let conn = db.0.lock().map_err(|_| "数据库被占用".to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT role, content, quote, created_at
             FROM messages WHERE session_id = ?1 ORDER BY id ASC",
        )
        .map_err(db_err)?;
    let rows = stmt
        .query_map(params![session_id], |r| {
            Ok(MessageRow {
                role: r.get(0)?,
                content: r.get(1)?,
                quote: r.get(2)?,
                created_at: r.get(3)?,
            })
        })
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;
    Ok(rows)
}

#[tauri::command]
pub fn chat_delete_session(db: State<'_, ChatDb>, session_id: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|_| "数据库被占用".to_string())?;
    // 不依赖 foreign_keys 约束，显式清理消息
    conn.execute("DELETE FROM messages WHERE session_id = ?1", params![session_id])
        .map_err(db_err)?;
    conn.execute("DELETE FROM sessions WHERE id = ?1", params![session_id])
        .map_err(db_err)?;
    Ok(())
}
