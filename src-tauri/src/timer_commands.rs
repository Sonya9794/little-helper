use crate::{
    choices, overlay,
    storage::Result,
    timer::{self, Config, Mode, View},
    AppState,
};
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Manager};
#[tauri::command]
pub fn timer_state(state: tauri::State<'_, AppState>) -> Result<View> {
    Ok(state
        .timer
        .lock()
        .map_err(|_| "Timer lock failed")?
        .view(timer::now_ms()))
}
#[tauri::command]
pub fn start_timer(state: tauri::State<'_, AppState>, mode: Mode, config: Config) -> Result<View> {
    state
        .timer
        .lock()
        .map_err(|_| "Timer lock failed")?
        .start(mode, config, timer::now_ms())
}
#[tauri::command]
pub fn pause_timer(state: tauri::State<'_, AppState>) -> Result<View> {
    state
        .timer
        .lock()
        .map_err(|_| "Timer lock failed")?
        .pause(timer::now_ms())
}
#[tauri::command]
pub fn resume_timer(state: tauri::State<'_, AppState>) -> Result<View> {
    state
        .timer
        .lock()
        .map_err(|_| "Timer lock failed")?
        .resume(timer::now_ms())
}
#[tauri::command]
pub fn reset_timer(state: tauri::State<'_, AppState>) -> Result<View> {
    Ok(state
        .timer
        .lock()
        .map_err(|_| "Timer lock failed")?
        .reset(timer::now_ms()))
}
#[tauri::command]
pub fn open_timer(app: AppHandle) -> Result<()> {
    if app.state::<AppState>().minimized.load(Ordering::SeqCst) {
        return Ok(());
    }
    choices::hide(&app)?;
    *app.state::<AppState>()
        .choices_group
        .lock()
        .map_err(|_| "Menu lock failed")? = choices::Group::LockIn;
    app.get_webview_window("panel")
        .ok_or("Panel missing")?
        .hide()
        .map_err(|e| e.to_string())?;
    let window = app
        .get_webview_window("timer")
        .ok_or("Timer window missing")?;
    choices::restore_window(&window)?;
    overlay::anchor_window(&app, "timer")?;
    window.show().map_err(|e| e.to_string())?;
    overlay::anchor_window(&app, "timer")?;
    window.set_focus().map_err(|e| e.to_string())
}
#[tauri::command]
pub fn close_timer(app: AppHandle) -> Result<()> {
    app.get_webview_window("timer")
        .ok_or("Timer window missing")?
        .hide()
        .map_err(|e| e.to_string())?;
    choices::select_group(&app, choices::Group::LockIn)
}
