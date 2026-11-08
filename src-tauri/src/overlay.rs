use crate::{
    storage::{self, Result},
    AppState,
};
use serde::{Deserialize, Serialize};
use std::sync::atomic::Ordering;
use tauri::{AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

#[derive(Clone, Copy, Serialize, Deserialize)]
struct SavedPosition {
    x: i32,
    y: i32,
}

fn reachable(
    window: &WebviewWindow,
    point: PhysicalPosition<i32>,
    size: PhysicalSize<u32>,
) -> Result<PhysicalPosition<i32>> {
    let monitors = window.available_monitors().map_err(|e| e.to_string())?;
    let monitor = monitors
        .iter()
        .min_by_key(|m| {
            let a = m.work_area();
            let x = point.x.clamp(
                a.position.x,
                a.position
                    .x
                    .saturating_add(a.size.width as i32)
                    .saturating_sub(size.width as i32)
                    .max(a.position.x),
            );
            let y = point.y.clamp(
                a.position.y,
                a.position
                    .y
                    .saturating_add(a.size.height as i32)
                    .saturating_sub(size.height as i32)
                    .max(a.position.y),
            );
            let dx = point.x as i128 - x as i128;
            let dy = point.y as i128 - y as i128;
            dx * dx + dy * dy
        })
        .ok_or("No available desktop monitor")?;
    let a = monitor.work_area();
    Ok(PhysicalPosition::new(
        point.x.clamp(
            a.position.x,
            (a.position.x + a.size.width as i32 - size.width as i32).max(a.position.x),
        ),
        point.y.clamp(
            a.position.y,
            (a.position.y + a.size.height as i32 - size.height as i32).max(a.position.y),
        ),
    ))
}
pub fn restore(app: &AppHandle) -> Result<()> {
    let window = app
        .get_webview_window("mascot")
        .ok_or("Mascot window missing")?;
    let path = app.state::<AppState>().root.join("window-position.json");
    let saved: Option<SavedPosition> = storage::read(&path)?;
    let point = saved
        .map(|p| PhysicalPosition::new(p.x, p.y))
        .unwrap_or_else(|| {
            window
                .primary_monitor()
                .ok()
                .flatten()
                .map(|m| {
                    PhysicalPosition::new(
                        m.work_area().position.x + 80,
                        m.work_area().position.y + 80,
                    )
                })
                .unwrap_or(PhysicalPosition::new(80, 80))
        });
    let size = window.outer_size().map_err(|e| e.to_string())?;
    window
        .set_position(reachable(&window, point, size)?)
        .map_err(|e| e.to_string())
}
pub fn save(app: &AppHandle) -> Result<()> {
    let state = app.state::<AppState>();
    let path = state.root.join("window-position.json");
    // Preserve a malformed existing position file just like the other local files.
    let _: Option<SavedPosition> = storage::read(&path)?;
    let window = app
        .get_webview_window("mascot")
        .ok_or("Mascot window missing")?;
    let p = window.outer_position().map_err(|e| e.to_string())?;
    storage::write(&path, &SavedPosition { x: p.x, y: p.y })
}
fn fitting_content(
    inner: PhysicalSize<u32>,
    outer: PhysicalSize<u32>,
    available: PhysicalSize<u32>,
) -> PhysicalSize<u32> {
    PhysicalSize::new(
        inner
            .width
            .saturating_sub(outer.width.saturating_sub(available.width))
            .max(1),
        inner
            .height
            .saturating_sub(outer.height.saturating_sub(available.height))
            .max(1),
    )
}
pub fn anchor(app: &AppHandle) -> Result<()> {
    let mascot = app
        .get_webview_window("mascot")
        .ok_or("Mascot window missing")?;
    let panel = app
        .get_webview_window("panel")
        .ok_or("Panel window missing")?;
    let p = mascot.outer_position().map_err(|e| e.to_string())?;
    let ms = mascot.outer_size().map_err(|e| e.to_string())?;
    let mut size = panel.outer_size().map_err(|e| e.to_string())?;
    let monitor = mascot
        .current_monitor()
        .map_err(|e| e.to_string())?
        .or(mascot.primary_monitor().map_err(|e| e.to_string())?)
        .ok_or("No monitor available")?;
    let area = monitor.work_area();
    if size.width > area.size.width || size.height > area.size.height {
        let inner = panel.inner_size().map_err(|e| e.to_string())?;
        panel
            .set_size(fitting_content(inner, size, area.size))
            .map_err(|e| e.to_string())?;
        size = panel.outer_size().map_err(|e| e.to_string())?;
    }
    let gap = (8.0 * monitor.scale_factor()).round() as i32;
    let right = p.x + ms.width as i32 + gap;
    let x = if right + size.width as i32 <= area.position.x + area.size.width as i32 {
        right
    } else {
        p.x - size.width as i32 - gap
    };
    panel
        .set_position(reachable(&panel, PhysicalPosition::new(x, p.y), size)?)
        .map_err(|e| e.to_string())
}
pub fn show_panel(app: &AppHandle) -> Result<()> {
    // Queued UI events/errors must not reopen a panel after minimizing to tray.
    if app.state::<AppState>().minimized.load(Ordering::SeqCst) {
        return Ok(());
    }
    anchor(app)?;
    let panel = app
        .get_webview_window("panel")
        .ok_or("Panel window missing")?;
    panel.show().map_err(|e| e.to_string())?;
    // Moving to another monitor can change the panel's physical size. Recheck
    // after the native move/show, before focusing it, using the current DPI.
    anchor(app)?;
    panel.set_focus().map_err(|e| e.to_string())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn panel_fit_includes_title_bar_and_frame() {
        let inner = PhysicalSize::new(360, 490);
        let outer = PhysicalSize::new(376, 529);
        assert_eq!(
            fitting_content(inner, outer, PhysicalSize::new(340, 500)),
            PhysicalSize::new(324, 461)
        );
        assert_eq!(
            fitting_content(inner, outer, PhysicalSize::new(1920, 1080)),
            inner
        );
    }
}
