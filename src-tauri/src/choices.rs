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
    LockIn,
    Games,
}
#[derive(Clone, Copy, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Group {
    #[default]
    Main,
    LockIn,
    Games,
}
pub fn group(app: &AppHandle) -> Result<Group> {
    app.state::<AppState>()
        .choices_group
        .lock()
        .map(|group| *group)
        .map_err(|_| "Menu state lock failed".into())
}
pub fn select_group(app: &AppHandle, group: Group) -> Result<()> {
    *app.state::<AppState>()
        .choices_group
        .lock()
        .map_err(|_| "Menu state lock failed")? = group;
    show(app)
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
    pub mirror_x: bool,
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
    if let Some(thought) = app.get_webview_window("thought") {
        thought.hide().map_err(|e| e.to_string())?;
    }
    hide(app)?;
    let state = app.state::<AppState>();
    *state
        .choices_group
        .lock()
        .map_err(|_| "Menu state lock failed")? =
        if matches!(page, Page::Habits | Page::Motivation | Page::LockIn) {
            Group::LockIn
        } else if matches!(page, Page::Games) {
            Group::Games
        } else {
            Group::Main
        };
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
        *app.state::<AppState>()
            .choices_group
            .lock()
            .map_err(|_| "Menu state lock failed")? = Group::Main;
        show(app)
    }
}
pub fn show(app: &AppHandle) -> Result<()> {
    if let Some(thought) = app.get_webview_window("thought") {
        thought.hide().map_err(|e| e.to_string())?;
    }
    if app.state::<AppState>().minimized.load(Ordering::SeqCst) {
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    {
        detail(
            app,
            match group(app)? {
                Group::LockIn => Page::LockIn,
                Group::Games => Page::Games,
                Group::Main => Page::Menu,
            },
            None,
        )
    }
    #[cfg(target_os = "windows")]
    {
        if let Some(todo) = app.get_webview_window("todo") {
            todo.hide().map_err(|e| e.to_string())?;
        }
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
    if window.label() == "thought" {
        let active = crate::thoughts::follow(app)?;
        let size = window.inner_size().map_err(|e| e.to_string())?;
        return Ok(Metrics {
            active,
            width: size.width,
            height: size.height,
            mascot: None,
            mirror_x: app
                .state::<AppState>()
                .thoughts
                .lock()
                .map_err(|_| "Thought state lock failed")?
                .mirror_x,
        });
    }
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
            mirror_x: false,
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
        mirror_x: false,
    })
}
