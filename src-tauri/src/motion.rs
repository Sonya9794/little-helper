//! Optional desktop-window motion, separate from artwork and local storage.
use crate::{overlay, storage::Result, AppState};
use serde::{Deserialize, Serialize};
use std::{
    sync::atomic::Ordering,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition};

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Mode {
    Normal,
    Dvd,
}

#[derive(Clone, Copy)]
pub struct Flight {
    x: f64,
    y: f64,
    vx: f64,
    vy: f64,
}
impl Flight {
    fn new(x: f64, y: f64, scale: f64) -> Self {
        Self {
            x,
            y,
            vx: 110.0 * scale,
            vy: 80.0 * scale,
        }
    }
    fn advance(&mut self, bounds: [f64; 4], seconds: f64) {
        (self.x, self.vx) = reflect(self.x, self.vx, bounds[0], bounds[2], seconds);
        (self.y, self.vy) = reflect(self.y, self.vy, bounds[1], bounds[3], seconds);
    }
}
fn reflect(position: f64, velocity: f64, min: f64, max: f64, seconds: f64) -> (f64, f64) {
    let span = max - min;
    if span <= 0.0 {
        return (min, velocity);
    }
    let folded = ((position.clamp(min, max) - min) + velocity * seconds).rem_euclid(2.0 * span);
    let (offset, speed) = if folded == 0.0 {
        (0.0, velocity.abs())
    } else if folded == span {
        (span, -velocity.abs())
    } else if folded < span {
        (folded, velocity)
    } else {
        (2.0 * span - folded, -velocity)
    };
    (min + offset, speed)
}

#[derive(Default)]
pub struct Motion {
    flight: Option<Flight>,
    last: Option<Instant>,
    rebase: bool,
}
impl Motion {
    fn pause(&mut self) {
        self.last = None;
        self.rebase = true;
    }
}
pub fn mode(state: &AppState) -> Mode {
    if state.dvd_enabled.load(Ordering::SeqCst) {
        Mode::Dvd
    } else {
        Mode::Normal
    }
}
pub fn set_mode(app: &AppHandle, mode: Mode) -> Result<()> {
    let state = app.state::<AppState>();
    let was_dvd = state.dvd_enabled.swap(mode == Mode::Dvd, Ordering::SeqCst);
    state.move_generation.fetch_add(1, Ordering::SeqCst);
    state
        .motion
        .lock()
        .map_err(|_| "Motion state lock failed")?
        .pause();
    if was_dvd && mode == Mode::Normal {
        overlay::save(app)?;
    }
    Ok(())
}

// Windows owns the release event during a native drag. Read only its button
// state while a drag we initiated is active; never capture global pointer data.
#[cfg(target_os = "windows")]
fn drag_finished() -> bool {
    #[link(name = "user32")]
    extern "system" {
        fn GetAsyncKeyState(key: i32) -> i16;
    }
    // SAFETY: GetAsyncKeyState has no pointer parameters; VK_LBUTTON is 1.
    unsafe { GetAsyncKeyState(1) >= 0 }
}
#[cfg(not(target_os = "windows"))]
fn drag_finished() -> bool {
    false
}

pub fn start_drag(app: &AppHandle) -> Result<()> {
    app.state::<AppState>()
        .motion_dragging
        .store(true, Ordering::SeqCst);
    let copy = app.clone();
    app.run_on_main_thread(move || {
        let result = copy
            .get_webview_window("mascot")
            .ok_or("Mascot window missing".to_string())
            .and_then(|window| window.start_dragging().map_err(|e| e.to_string()));
        // AppKit's native drag runs synchronously on this thread; Windows posts it.
        if !cfg!(target_os = "windows") || result.is_err() {
            copy.state::<AppState>()
                .motion_dragging
                .store(false, Ordering::SeqCst);
        }
        if let Err(error) = result {
            crate::report(&copy, error);
        }
    })
    .map_err(|e| e.to_string())
}

fn tick(app: &AppHandle) -> Result<()> {
    let state = app.state::<AppState>();
    if mode(&state) != Mode::Dvd {
        return Ok(());
    }
    if state.motion_dragging.load(Ordering::SeqCst) && drag_finished() {
        state.motion_dragging.store(false, Ordering::SeqCst);
    }
    let window = app
        .get_webview_window("mascot")
        .ok_or("Mascot window missing")?;
    let panel = app
        .get_webview_window("panel")
        .ok_or("Panel window missing")?;
    let blocked = state.minimized.load(Ordering::SeqCst)
        || state.choices_open.load(Ordering::SeqCst)
        || state.motion_hovered.load(Ordering::SeqCst)
        || state.motion_dragging.load(Ordering::SeqCst)
        || state.motion_context.load(Ordering::SeqCst)
        || !state.mask_ready.load(Ordering::SeqCst)
        || !window.is_visible().map_err(|e| e.to_string())?
        || panel.is_visible().map_err(|e| e.to_string())?;
    let mut motion = state
        .motion
        .lock()
        .map_err(|_| "Motion state lock failed")?;
    if blocked {
        motion.pause();
        return Ok(());
    }
    let now = Instant::now();
    let seconds = motion
        .last
        .replace(now)
        .map(|last| now.duration_since(last).as_secs_f64().min(0.05))
        .unwrap_or(0.0);
    let monitor = window
        .current_monitor()
        .map_err(|e| e.to_string())?
        .or(window.primary_monitor().map_err(|e| e.to_string())?)
        .ok_or("No desktop monitor available")?;
    let area = monitor.work_area();
    let size = window.outer_size().map_err(|e| e.to_string())?;
    let position = window.outer_position().map_err(|e| e.to_string())?;
    let scale = monitor.scale_factor();
    if motion.flight.is_none() {
        motion.flight = Some(Flight::new(position.x as f64, position.y as f64, scale));
    }
    let rebase = motion.rebase;
    motion.rebase = false;
    let flight = motion.flight.as_mut().ok_or("Motion state missing")?;
    if rebase {
        flight.x = position.x as f64;
        flight.y = position.y as f64;
    }
    flight.vx = flight.vx.signum() * 110.0 * scale;
    flight.vy = flight.vy.signum() * 80.0 * scale;
    flight.advance(
        [
            area.position.x as f64,
            area.position.y as f64,
            area.position.x as f64 + area.size.width.saturating_sub(size.width) as f64,
            area.position.y as f64 + area.size.height.saturating_sub(size.height) as f64,
        ],
        seconds,
    );
    let target = PhysicalPosition::new(flight.x.round() as i32, flight.y.round() as i32);
    drop(motion);
    if target != position && state.dvd_enabled.load(Ordering::SeqCst) {
        window.set_position(target).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn install(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || loop {
        let state = app.state::<AppState>();
        let active = mode(&state) == Mode::Dvd;
        std::thread::sleep(Duration::from_millis(if active { 16 } else { 100 }));
        if !active || state.motion_pending.swap(true, Ordering::SeqCst) {
            continue;
        }
        let copy = app.clone();
        if app
            .run_on_main_thread(move || {
                if let Err(error) = tick(&copy) {
                    copy.state::<AppState>()
                        .dvd_enabled
                        .store(false, Ordering::SeqCst);
                    crate::report(&copy, error);
                    let _ = copy.emit("mode-changed", Mode::Normal);
                }
                copy.state::<AppState>()
                    .motion_pending
                    .store(false, Ordering::SeqCst);
            })
            .is_err()
        {
            state.motion_pending.store(false, Ordering::SeqCst);
            break;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn reflects_at_both_edges_without_losing_overshoot() {
        assert_eq!(reflect(9.0, 4.0, 0.0, 10.0, 1.0), (7.0, -4.0));
        assert_eq!(reflect(1.0, -4.0, 0.0, 10.0, 1.0), (3.0, 4.0));
    }
    #[test]
    fn exact_corner_reverses_both_components() {
        let mut flight = Flight {
            x: 9.0,
            y: 9.0,
            vx: 1.0,
            vy: 1.0,
        };
        flight.advance([0.0, 0.0, 10.0, 10.0], 1.0);
        assert_eq!(
            (flight.x, flight.y, flight.vx, flight.vy),
            (10.0, 10.0, -1.0, -1.0)
        );
    }
    #[test]
    fn negative_monitor_coordinates_and_large_steps_remain_bounded() {
        for speed in [-517.0, 517.0] {
            let (position, _) = reflect(-1300.0, speed, -1920.0, -128.0, 500.0);
            assert!((-1920.0..=-128.0).contains(&position));
        }
    }
    #[test]
    fn changed_or_tiny_work_area_keeps_the_mascot_reachable() {
        assert_eq!(reflect(500.0, 10.0, 0.0, 20.0, 0.0).0, 20.0);
        assert_eq!(reflect(500.0, 10.0, -50.0, -50.0, 10.0).0, -50.0);
    }
    #[test]
    fn fractional_motion_accumulates_at_the_same_speed_across_frame_rates() {
        let mut a = Flight::new(0.0, 0.0, 1.0);
        let mut b = a;
        for _ in 0..60 {
            a.advance([0.0, 0.0, 2000.0, 2000.0], 1.0 / 60.0);
        }
        b.advance([0.0, 0.0, 2000.0, 2000.0], 1.0);
        assert!((a.x - b.x).abs() < 0.001 && (a.y - b.y).abs() < 0.001);
    }
    #[test]
    fn pause_discards_elapsed_time_and_requires_rebasing_after_a_drag() {
        let mut motion = Motion {
            flight: Some(Flight::new(1.0, 2.0, 1.0)),
            last: Some(Instant::now()),
            rebase: false,
        };
        motion.pause();
        assert!(motion.last.is_none());
        assert!(motion.rebase);
    }
    #[test]
    fn modes_are_only_normal_and_dvd() {
        assert_eq!(serde_json::from_str::<Mode>("\"dvd\"").unwrap(), Mode::Dvd);
        assert!(serde_json::from_str::<Mode>("\"unknown\"").is_err());
    }
}
