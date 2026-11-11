use crate::{choices, overlay, storage::Result, AppState};
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Manager};

// Shared native lifecycle only; game rules and session state stay in their own modules.
pub fn open(app: &AppHandle, label: &str) -> Result<()> {
    if app.state::<AppState>().minimized.load(Ordering::SeqCst) {
        return Ok(());
    }
    choices::hide(app)?;
    *app.state::<AppState>()
        .choices_group
        .lock()
        .map_err(|_| "Menu state lock failed")? = choices::Group::Games;
    app.get_webview_window("panel")
        .ok_or("Panel missing")?
        .hide()
        .map_err(|e| e.to_string())?;
    let window = app.get_webview_window(label).ok_or("Game window missing")?;
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
pub fn open_blackjack(app: AppHandle) -> Result<()> {
    open(&app, "blackjack")
}
#[tauri::command]
pub fn close_blackjack(app: AppHandle) -> Result<()> {
    app.get_webview_window("blackjack")
        .ok_or("Blackjack window missing")?
        .hide()
        .map_err(|e| e.to_string())?;
    choices::select_group(&app, choices::Group::Games)
}
