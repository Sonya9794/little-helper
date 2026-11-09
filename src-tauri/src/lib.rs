mod chess;
mod chess_commands;
mod choices;
mod execution;
mod habits;
mod history;
mod hit_test;
mod motion;
mod overlay;
mod storage;
mod todo;
mod todo_commands;
mod tray;

use execution::{LocalHistoryOnly, PromptSubmission};
use serde::Serialize;
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, AtomicU64, AtomicU8, Ordering},
        Mutex,
    },
};
use storage::Result;
use tauri::{Emitter, Manager};

pub(crate) struct AppState {
    root: PathBuf,
    serial: Mutex<()>,
    errors: Mutex<Vec<String>>,
    minimized: AtomicBool,
    mask_ready: AtomicBool,
    initialized: AtomicBool,
    choices_open: AtomicBool,
    choices_group: Mutex<choices::Group>,
    panel_request: Mutex<choices::Request>,
    move_generation: AtomicU64,
    dvd_enabled: AtomicBool,
    motion_hovered: AtomicBool,
    motion_dragging: AtomicBool,
    motion_pending: AtomicBool,
    motion_context: AtomicBool,
    motion: Mutex<motion::Motion>,
    chess_active: AtomicBool,
    chess_energy: AtomicU8,
    chess_roam: Mutex<Option<std::time::Instant>>,
}
pub(crate) fn report(app: &tauri::AppHandle, error: String) {
    if let Some(state) = app.try_state::<AppState>() {
        if let Ok(mut errors) = state.errors.lock() {
            if !errors.contains(&error) {
                errors.push(error);
            }
        }
        let _ = app.emit("local-error", ());
    }
}
#[derive(Serialize)]
struct Snapshot {
    history: Option<history::Summary>,
    history_error: Option<String>,
    habits: Option<habits::Habits>,
    habit_error: Option<String>,
    notices: Vec<String>,
}
#[tauri::command]
fn startup_ready(app: tauri::AppHandle) -> bool {
    app.try_state::<AppState>()
        .map(|state| state.initialized.load(Ordering::SeqCst))
        .unwrap_or(false)
}
#[tauri::command]
fn get_mode(state: tauri::State<'_, AppState>) -> motion::Mode {
    motion::mode(&state)
}
#[tauri::command]
fn set_mode(app: tauri::AppHandle, mode: motion::Mode) -> Result<()> {
    motion::set_mode(&app, mode)
}
#[tauri::command]
fn motion_hover(state: tauri::State<'_, AppState>, hovered: bool) {
    state.motion_hovered.store(hovered, Ordering::SeqCst);
}
#[tauri::command]
fn snapshot(state: tauri::State<'_, AppState>) -> Result<Snapshot> {
    let _guard = state
        .serial
        .lock()
        .map_err(|_| "Local storage lock failed")?;
    let history =
        history::History::load(&state.root.join("prompt-history.json")).map(|h| h.summary());
    let habits =
        habits::Habits::load_for_date(&state.root.join("habits.json"), &habits::local_date());
    Ok(Snapshot {
        history_error: history.as_ref().err().cloned(),
        history: history.ok(),
        habit_error: habits.as_ref().err().cloned(),
        habits: habits.ok(),
        notices: state
            .errors
            .lock()
            .map_err(|_| "Local error lock failed")?
            .clone(),
    })
}
#[tauri::command]
fn submit_prompt(state: tauri::State<'_, AppState>, text: String) -> Result<history::Summary> {
    let _guard = state
        .serial
        .lock()
        .map_err(|_| "Local storage lock failed")?;
    LocalHistoryOnly(state.root.join("prompt-history.json"))
        .submit(text)
        .map(|h| h.summary())
}
#[tauri::command]
fn edit_habit(state: tauri::State<'_, AppState>, edit: habits::Edit) -> Result<habits::Habits> {
    let _guard = state
        .serial
        .lock()
        .map_err(|_| "Local storage lock failed")?;
    habits::Habits::update(&state.root.join("habits.json"), edit, &habits::local_date())
}
#[tauri::command]
fn show_menu(app: tauri::AppHandle) -> Result<()> {
    choices::toggle(&app)
}
#[tauri::command]
fn open_detail(app: tauri::AppHandle, page: choices::Page, text: Option<String>) -> Result<()> {
    choices::detail(&app, page, text)
}
#[tauri::command]
fn panel_request(state: tauri::State<'_, AppState>) -> Result<choices::Request> {
    state
        .panel_request
        .lock()
        .map(|r| r.clone())
        .map_err(|_| "Panel state lock failed".into())
}
#[tauri::command]
fn return_to_choices(app: tauri::AppHandle) -> Result<()> {
    choices::show(&app)
}
#[tauri::command]
fn hide_choices(app: tauri::AppHandle) -> Result<()> {
    choices::hide(&app)
}
#[tauri::command]
fn get_choice_group(app: tauri::AppHandle) -> Result<choices::Group> {
    choices::group(&app)
}
#[tauri::command]
fn set_choice_group(app: tauri::AppHandle, group: choices::Group) -> Result<()> {
    choices::select_group(&app, group)
}
#[tauri::command]
fn prepare_scene(app: tauri::AppHandle, window: tauri::WebviewWindow) -> Result<choices::Metrics> {
    choices::prepare(&app, &window)
}
#[tauri::command]
fn hide_panel(app: tauri::AppHandle) -> Result<()> {
    app.get_webview_window("panel")
        .ok_or("Panel window missing")?
        .hide()
        .map_err(|e| e.to_string())
}
#[tauri::command]
fn start_drag(app: tauri::AppHandle) -> Result<()> {
    choices::hide(&app)?;
    hide_panel(app.clone())?;
    motion::start_drag(&app)
}
#[tauri::command]
fn context_menu(app: tauri::AppHandle) -> Result<()> {
    let item =
        tauri::menu::MenuItem::with_id(&app, "minimize", "Minimize to tray", true, None::<&str>)
            .map_err(|e| e.to_string())?;
    let menu = tauri::menu::Menu::with_items(&app, &[&item]).map_err(|e| e.to_string())?;
    let window = app
        .get_webview_window("mascot")
        .ok_or("Mascot window missing")?;
    app.state::<AppState>()
        .motion_context
        .store(true, Ordering::SeqCst);
    let result = window.popup_menu(&menu).map_err(|e| e.to_string());
    app.state::<AppState>()
        .motion_context
        .store(false, Ordering::SeqCst);
    result
}
#[tauri::command]
fn install_mask(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    width: u32,
    height: u32,
    alpha: Vec<u8>,
) -> Result<()> {
    if !["mascot", "choices"].contains(&window.label()) {
        return Err("Not an overlay window".into());
    }
    if let Some(warning) = hit_test::install(&window, width, height, &alpha)? {
        report(&app, warning);
    }
    let state = app.state::<AppState>();
    if window.label() == "mascot" {
        state.mask_ready.store(true, Ordering::SeqCst);
    }
    let should_show = window.label() == "mascot" || state.choices_open.load(Ordering::SeqCst);
    if should_show && !state.minimized.load(Ordering::SeqCst) {
        let was_visible = window.is_visible().map_err(|e| e.to_string())?;
        if !was_visible {
            window.show().map_err(|e| e.to_string())?;
        }
        if window.label() == "choices" && !was_visible {
            window.set_focus().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
#[tauri::command]
fn ui_error(app: tauri::AppHandle, message: String) {
    report(&app, message);
    let _ = choices::hide(&app);
    if let Err(e) = overlay::show_panel(&app) {
        report(&app, e);
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            tray::show(app);
        }))
        .setup(|app| {
            let root = app.path().app_data_dir()?;
            app.manage(AppState {
                root,
                serial: Mutex::new(()),
                errors: Mutex::new(vec![]),
                minimized: AtomicBool::new(false),
                mask_ready: AtomicBool::new(false),
                initialized: AtomicBool::new(false),
                choices_open: AtomicBool::new(false),
                choices_group: Mutex::new(choices::Group::Main),
                panel_request: Mutex::new(choices::Request::default()),
                move_generation: AtomicU64::new(0),
                dvd_enabled: AtomicBool::new(false),
                motion_hovered: AtomicBool::new(false),
                motion_dragging: AtomicBool::new(false),
                motion_pending: AtomicBool::new(false),
                motion_context: AtomicBool::new(false),
                motion: Mutex::new(motion::Motion::default()),
                chess_active: AtomicBool::new(false),
                chess_energy: AtomicU8::new(2),
                chess_roam: Mutex::new(None),
            });
            // WebViews can pump IPC during construction. Register state first,
            // explicitly create the windows, then release the UI startup gate.
            for config in app.config().app.windows.clone() {
                if config.label == "choices" && !cfg!(target_os = "windows") {
                    continue;
                }
                tauri::WebviewWindowBuilder::from_config(app, &config)?.build()?;
            }
            tray::install(app.handle())?;
            if let Err(error) =
                chess::Store::recover(&app.state::<AppState>().root.join("chess.json"))
            {
                report(app.handle(), error);
            }
            if let Err(e) = overlay::restore(app.handle()) {
                report(app.handle(), e);
            }
            // Check the saved local date on startup even if the tracker stays closed.
            let state = app.state::<AppState>();
            if let Err(e) = habits::Habits::load_for_date(
                &state.root.join("habits.json"),
                &habits::local_date(),
            ) {
                report(app.handle(), e);
            }
            state.initialized.store(true, Ordering::SeqCst);
            motion::install(app.handle());
            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id.as_ref() == "minimize" {
                tray::hide(app);
            }
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                if window.label() == "mascot" {
                    tray::hide(window.app_handle());
                } else if window.label() == "chess" {
                    let _ = window.emit("chess-close-request", ());
                } else if window.label() == "choices" {
                    if let Err(e) = choices::hide(window.app_handle()) {
                        report(window.app_handle(), e);
                    }
                } else if let Err(e) = window.hide() {
                    report(window.app_handle(), e.to_string());
                }
            }
            tauri::WindowEvent::Moved(_) if window.label() == "mascot" => {
                if let Some(state) = window.app_handle().try_state::<AppState>() {
                    if !state.initialized.load(Ordering::SeqCst) {
                        return;
                    }
                    // DVD ticks are transient; never spawn a save thread or write
                    // personal storage for each animation frame. Save on stop/tray/quit.
                    if state.dvd_enabled.load(Ordering::SeqCst) || motion::chess_burst(&state) {
                        return;
                    }
                    let generation = state.move_generation.fetch_add(1, Ordering::SeqCst) + 1;
                    let app = window.app_handle().clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(250));
                        if app
                            .state::<AppState>()
                            .move_generation
                            .load(Ordering::SeqCst)
                            != generation
                        {
                            return;
                        }
                        let copy = app.clone();
                        let _ = app.run_on_main_thread(move || {
                            if let Err(e) = overlay::save(&copy) {
                                report(&copy, e);
                            }
                        });
                    });
                }
            }
            tauri::WindowEvent::ScaleFactorChanged { .. } if window.label() == "mascot" => {
                if let Some(state) = window.app_handle().try_state::<AppState>() {
                    state.mask_ready.store(false, Ordering::SeqCst);
                }
                let _ = window.hide();
                let _ = window.emit("mask-refresh", ());
            }
            tauri::WindowEvent::ScaleFactorChanged { .. } if window.label() == "choices" => {
                let _ = window.hide();
                let _ = window.emit("choices-refresh", ());
            }
            tauri::WindowEvent::Focused(true) => {
                let _ = window.emit("date-check", ());
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            startup_ready,
            todo_commands::todo_state,
            todo_commands::edit_todo,
            todo_commands::open_todo,
            todo_commands::close_todo,
            chess_commands::chess_store,
            chess_commands::save_chess_settings,
            chess_commands::begin_chess,
            chess_commands::chess_progress,
            chess_commands::finish_chess,
            chess_commands::export_chess,
            chess_commands::open_chess,
            chess_commands::hide_chess,
            chess_commands::chess_react,
            get_mode,
            set_mode,
            motion_hover,
            snapshot,
            submit_prompt,
            edit_habit,
            show_menu,
            open_detail,
            panel_request,
            return_to_choices,
            hide_choices,
            get_choice_group,
            set_choice_group,
            prepare_scene,
            hide_panel,
            start_drag,
            context_menu,
            install_mask,
            ui_error
        ])
        .run(tauri::generate_context!())
        .expect("Little Helper could not start");
}
