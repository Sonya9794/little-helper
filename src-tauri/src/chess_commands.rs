use crate::{
    chess::{self, Game, Options, Outcome, Settings, Store},
    choices, overlay,
    storage::Result,
    AppState,
};
use serde::{Deserialize, Serialize};
use std::{
    sync::atomic::Ordering,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager};

#[tauri::command]
pub fn chess_store(state: tauri::State<'_, AppState>) -> Result<Store> {
    let _guard = state.serial.lock().map_err(|_| "Storage lock failed")?;
    Store::load(&state.root.join("chess.json"))
}
#[tauri::command]
pub fn save_chess_settings(state: tauri::State<'_, AppState>, settings: Settings) -> Result<Store> {
    let _guard = state.serial.lock().map_err(|_| "Storage lock failed")?;
    Store::save_settings(&state.root.join("chess.json"), settings)
}
#[tauri::command]
pub fn begin_chess(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    options: Options,
) -> Result<Game> {
    let _guard = state.serial.lock().map_err(|_| "Storage lock failed")?;
    let game = Store::begin(&state.root.join("chess.json"), options)?;
    *state.chess_roam.lock().map_err(|_| "Motion lock failed")? = None;
    let _ = app.emit_to("mascot", "chess-reaction-reset", ());
    state.chess_active.store(true, Ordering::SeqCst);
    state
        .chess_energy
        .store(game.options.energy, Ordering::SeqCst);
    Ok(game)
}
#[tauri::command]
pub fn chess_progress(state: tauri::State<'_, AppState>, id: u64, pgn: String) -> Result<()> {
    let _guard = state.serial.lock().map_err(|_| "Storage lock failed")?;
    Store::progress(&state.root.join("chess.json"), id, pgn)
}
#[tauri::command]
pub fn finish_chess(
    state: tauri::State<'_, AppState>,
    id: u64,
    outcome: Outcome,
    pgn: String,
) -> Result<Store> {
    let _guard = state.serial.lock().map_err(|_| "Storage lock failed")?;
    let store = Store::finish(&state.root.join("chess.json"), id, outcome, pgn)?;
    state.chess_active.store(false, Ordering::SeqCst);
    Ok(store)
}
#[tauri::command]
pub fn export_chess(app: AppHandle, id: u64) -> Result<String> {
    let state = app.state::<AppState>();
    let _guard = state.serial.lock().map_err(|_| "Storage lock failed")?;
    chess::export(
        &state.root.join("chess.json"),
        &app.path().download_dir().map_err(|e| e.to_string())?,
        id,
    )
}
#[tauri::command]
pub fn open_chess(app: AppHandle) -> Result<()> {
    choices::hide(&app)?;
    app.get_webview_window("panel")
        .ok_or("Panel missing")?
        .hide()
        .map_err(|e| e.to_string())?;
    let window = app
        .get_webview_window("chess")
        .ok_or("Chess window missing")?;
    choices::restore_window(&window)?;
    if let Some(monitor) = window.current_monitor().map_err(|e| e.to_string())? {
        let area = monitor.work_area();
        let outer = window.outer_size().map_err(|e| e.to_string())?;
        if outer.width > area.size.width || outer.height > area.size.height {
            let inner = window.inner_size().map_err(|e| e.to_string())?;
            window
                .set_size(tauri::PhysicalSize::new(
                    inner
                        .width
                        .saturating_sub(outer.width.saturating_sub(area.size.width))
                        .max(1),
                    inner
                        .height
                        .saturating_sub(outer.height.saturating_sub(area.size.height))
                        .max(1),
                ))
                .map_err(|e| e.to_string())?;
        }
    }
    let point = window.outer_position().map_err(|e| e.to_string())?;
    let size = window.outer_size().map_err(|e| e.to_string())?;
    window
        .set_position(overlay::reachable(&window, point, size)?)
        .map_err(|e| e.to_string())?;
    window.show().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}
#[tauri::command]
pub fn hide_chess(app: AppHandle) -> Result<()> {
    app.get_webview_window("chess")
        .ok_or("Chess window missing")?
        .hide()
        .map_err(|e| e.to_string())
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReactionKind {
    Checked,
    Checking,
    Capture,
    PlayerCapture,
    Win,
    Loss,
    Draw,
}
#[derive(Clone, Serialize)]
pub struct Reaction {
    pub kind: ReactionKind,
    pub energy: u8,
}
#[tauri::command]
pub fn chess_react(app: AppHandle, kind: ReactionKind, reduced_motion: bool) -> Result<()> {
    let state = app.state::<AppState>();
    let energy = state.chess_energy.load(Ordering::SeqCst);
    if energy == 3 && !reduced_motion {
        *state.chess_roam.lock().map_err(|_| "Motion lock failed")? =
            Some(Instant::now() + Duration::from_secs(4));
    }
    app.emit_to("mascot", "chess-reaction", Reaction { kind, energy })
        .map_err(|e| e.to_string())
}
