use crate::{choices, overlay, storage::Result, todo, AppState};
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Manager};
#[tauri::command]
pub fn todo_state(state: tauri::State<'_, AppState>) -> Result<todo::Store> {
    let _guard = state.serial.lock().map_err(|_| "Storage lock failed")?;
    todo::Store::load(&state.root.join("todo.json"))
}
#[tauri::command]
pub fn edit_todo(state: tauri::State<'_, AppState>, edit: todo::Edit) -> Result<todo::Store> {
    let _guard = state.serial.lock().map_err(|_| "Storage lock failed")?;
    todo::Store::edit(&state.root.join("todo.json"), edit)
}
#[tauri::command]
pub fn open_todo(app: AppHandle) -> Result<()> {
    if app.state::<AppState>().minimized.load(Ordering::SeqCst) {
        return Ok(());
    }
    choices::hide(&app)?;
    *app.state::<AppState>()
        .choices_group
        .lock()
        .map_err(|_| "Menu state lock failed")? = choices::Group::LockIn;
    app.get_webview_window("panel")
        .ok_or("Panel missing")?
        .hide()
        .map_err(|e| e.to_string())?;
    let window = app
        .get_webview_window("todo")
        .ok_or("To-Do window missing")?;
    choices::restore_window(&window)?;
    overlay::anchor_window(&app, "todo")?;
    window.show().map_err(|e| e.to_string())?;
    overlay::anchor_window(&app, "todo")?;
    window.set_focus().map_err(|e| e.to_string())
}
#[tauri::command]
pub fn close_todo(app: AppHandle, back: bool) -> Result<()> {
    app.get_webview_window("todo")
        .ok_or("To-Do window missing")?
        .hide()
        .map_err(|e| e.to_string())?;
    if back {
        choices::select_group(&app, choices::Group::LockIn)?;
    }
    Ok(())
}
