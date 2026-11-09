use crate::{overlay, AppState};
use std::sync::atomic::Ordering;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager,
};

pub fn hide(app: &AppHandle) {
    app.state::<AppState>()
        .motion_hovered
        .store(false, Ordering::SeqCst);
    if let Err(e) = crate::choices::hide(app) {
        crate::report(app, e);
    }
    if let Err(error) = overlay::save(app) {
        crate::report(app, error);
    }
    app.state::<AppState>()
        .minimized
        .store(true, Ordering::SeqCst);
    for label in ["mascot", "panel"] {
        if let Some(w) = app.get_webview_window(label) {
            if let Err(e) = w.hide() {
                crate::report(app, e.to_string());
            }
        }
    }
}
pub fn show(app: &AppHandle) {
    let Some(state) = app.try_state::<AppState>() else {
        return;
    };
    state.minimized.store(false, Ordering::SeqCst);
    state.motion_hovered.store(false, Ordering::SeqCst);
    if let Some(window) = app.get_webview_window("mascot") {
        if let Err(e) = crate::choices::restore_window(&window) {
            crate::report(app, e);
        }
    }
    if let Err(error) = overlay::restore(app) {
        crate::report(app, error);
    }
    if let Some(window) = app.get_webview_window("mascot") {
        if state.mask_ready.load(Ordering::SeqCst) {
            if let Err(e) = window.show() {
                crate::report(app, e.to_string());
            }
        } else if let Err(e) = window.emit("mask-refresh", ()) {
            crate::report(app, e.to_string());
        }
    }
    // Also checks local date when restoring, including after sleep or clock changes.
    let reset = state
        .serial
        .lock()
        .map_err(|_| "Local storage lock failed".to_string())
        .and_then(|_guard| {
            crate::habits::Habits::load_for_date(
                &state.root.join("habits.json"),
                &crate::habits::local_date(),
            )
        });
    if let Err(e) = reset {
        crate::report(app, e);
    }
    #[cfg(not(target_os = "windows"))]
    if let Err(e) = overlay::show_panel(app) {
        crate::report(app, e);
    }
}
pub fn install(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show Little Helper", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;
    let mut rgba = vec![0_u8; 32 * 32 * 4];
    for y in 4..28 {
        for x in 6..26 {
            let i = (y * 32 + x) * 4;
            let eye = (x == 12 || x == 20) && (11..15).contains(&y);
            rgba[i..i + 4].copy_from_slice(if eye {
                &[36, 61, 76, 255]
            } else {
                &[255, 208, 119, 255]
            });
        }
    }
    TrayIconBuilder::new()
        .icon(Image::new_owned(rgba, 32, 32))
        .tooltip("Little Helper")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_app(app),
            "quit" => {
                if let Err(e) = overlay::save(app) {
                    crate::report(app, e);
                }
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;
    Ok(())
}
fn show_app(app: &AppHandle) {
    show(app);
}
