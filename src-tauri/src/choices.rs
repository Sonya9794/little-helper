use crate::{overlay, storage::Result, AppState};
use serde::{Deserialize, Serialize};
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, Manager, WebviewWindow};
#[cfg(target_os = "windows")]
use tauri::{PhysicalPosition, PhysicalSize};

#[derive(Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Page {
    #[default]
    Menu,
    Prompt,
    Saved,
    Habits,
    Motivation,
}
#[derive(Clone, Default, Serialize)]
pub struct Request {
    pub page: Page,
    pub text: Option<String>,
    pub revision: u64,
}
#[derive(Serialize)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}
#[derive(Serialize)]
pub struct Metrics {
    pub active: bool,
    pub width: u32,
    pub height: u32,
    pub mascot: Option<Rect>,
}

pub fn restore_window(window: &WebviewWindow) -> Result<()> {
    if window.is_minimized().map_err(|e| e.to_string())? {
        window.unminimize().map_err(|e| e.to_string())?;
    }
    Ok(())
}
pub fn hide(app: &AppHandle) -> Result<()> {
    app.state::<AppState>()
        .choices_open
        .store(false, Ordering::SeqCst);
    if let Some(window) = app.get_webview_window("choices") {
        window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}
pub fn detail(app: &AppHandle, page: Page, text: Option<String>) -> Result<()> {
    hide(app)?;
    let state = app.state::<AppState>();
    let request = {
        let mut request = state
            .panel_request
            .lock()
            .map_err(|_| "Panel state lock failed")?;
        request.page = page;
        request.text = text;
        request.revision = request.revision.wrapping_add(1);
        request.clone()
    };
    app.emit_to("panel", "panel-opened", request)
        .map_err(|e| e.to_string())?;
    overlay::show_panel(app)
}
pub fn toggle(app: &AppHandle) -> Result<()> {
    if app.state::<AppState>().choices_open.load(Ordering::SeqCst) {
        hide(app)
    } else {
        show(app)
    }
}
pub fn show(app: &AppHandle) -> Result<()> {
    if app.state::<AppState>().minimized.load(Ordering::SeqCst) {
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    {
        detail(app, Page::Menu, None)
    }
    #[cfg(target_os = "windows")]
    {
        app.get_webview_window("panel")
            .ok_or("Panel window missing")?
            .hide()
            .map_err(|e| e.to_string())?;
        let window = app
            .get_webview_window("choices")
            .ok_or("Choices window missing")?;
        restore_window(&window)?;
        window.hide().map_err(|e| e.to_string())?;
        let mascot = app
            .get_webview_window("mascot")
            .ok_or("Mascot window missing")?;
        let monitor = mascot
            .current_monitor()
            .map_err(|e| e.to_string())?
            .ok_or("No mascot monitor")?;
        let area = monitor.work_area();
        let p = mascot.outer_position().map_err(|e| e.to_string())?;
        let size = mascot.outer_size().map_err(|e| e.to_string())?;
        // Moving to another monitor can change the window's DPI. Recheck the size.
        for _ in 0..2 {
            window
                .set_size(PhysicalSize::new(
                    ((552.0 * monitor.scale_factor()).round() as u32)
                        .min(area.size.width.saturating_sub(12))
                        .max(1),
                    ((330.0 * monitor.scale_factor()).round() as u32)
                        .min(area.size.height.saturating_sub(12))
                        .max(1),
                ))
                .map_err(|e| e.to_string())?;
            let outer = window.outer_size().map_err(|e| e.to_string())?;
            let x = p.x + size.width as i32 / 2 - outer.width as i32 / 2;
            let y = p.y + size.height as i32 / 2 - outer.height as i32 / 2;
            window
                .set_position(PhysicalPosition::new(
                    x.clamp(
                        area.position.x,
                        (area.position.x + area.size.width as i32 - outer.width as i32)
                            .max(area.position.x),
                    ),
                    y.clamp(
                        area.position.y,
                        (area.position.y + area.size.height as i32 - outer.height as i32)
                            .max(area.position.y),
                    ),
                ))
                .map_err(|e| e.to_string())?;
        }
        app.state::<AppState>()
            .choices_open
            .store(true, Ordering::SeqCst);
        app.emit_to("choices", "choices-refresh", ())
            .map_err(|e| e.to_string())
    }
}
pub fn prepare(app: &AppHandle, window: &WebviewWindow) -> Result<Metrics> {
    if !["mascot", "choices"].contains(&window.label()) {
        return Err("Not an overlay window".into());
    }
    let state = app.state::<AppState>();
    let active = !state.minimized.load(Ordering::SeqCst)
        && (window.label() == "mascot" || state.choices_open.load(Ordering::SeqCst));
    if !active {
        window.hide().map_err(|e| e.to_string())?;
        return Ok(Metrics {
            active: false,
            width: 0,
            height: 0,
            mascot: None,
        });
    }
    restore_window(window)?;
    if window.label() == "choices" {
        window.hide().map_err(|e| e.to_string())?;
    }
    if window.label() == "mascot" {
        app.state::<AppState>()
            .mask_ready
            .store(false, Ordering::SeqCst);
    }
    let size = window.inner_size().map_err(|e| e.to_string())?;
    let mascot = if window.label() == "choices" {
        let mascot = app
            .get_webview_window("mascot")
            .ok_or("Mascot window missing")?;
        let origin = window.inner_position().map_err(|e| e.to_string())?;
        let p = mascot.outer_position().map_err(|e| e.to_string())?;
        let size = mascot.outer_size().map_err(|e| e.to_string())?;
        Some(Rect {
            x: p.x - origin.x,
            y: p.y - origin.y,
            width: size.width,
            height: size.height,
        })
    } else {
        None
    };
    Ok(Metrics {
        active: true,
        width: size.width,
        height: size.height,
        mascot,
    })
}
