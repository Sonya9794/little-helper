use crate::{
    storage::{self, Result},
    AppState,
};
use serde::{Deserialize, Serialize};
use std::{
    path::Path,
    sync::atomic::Ordering,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition};

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Settings {
    pub version: u8,
    pub enabled: bool,
    pub jokes: bool,
    pub facts: bool,
    pub motivation: bool,
    #[serde(default = "default_min_minutes")]
    pub min_minutes: u32,
    #[serde(default = "default_max_minutes")]
    pub max_minutes: u32,
}
fn default_min_minutes() -> u32 {
    3
}
fn default_max_minutes() -> u32 {
    10
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            version: 1,
            enabled: false,
            jokes: true,
            facts: true,
            motivation: true,
            min_minutes: 3,
            max_minutes: 10,
        }
    }
}
impl Settings {
    pub fn active(self) -> bool {
        self.enabled && (self.jokes || self.facts || self.motivation)
    }
    pub fn load(path: &Path) -> Result<Self> {
        let settings = storage::read::<Self>(path)?.unwrap_or_default();
        if settings.version != 1 {
            return Err(
                "Unsupported Helper Thoughts settings version. The file was not changed.".into(),
            );
        }
        settings.validate()?;
        Ok(settings)
    }
    fn save(path: &Path, settings: Self) -> Result<()> {
        Self::load(path)?;
        if settings.version != 1 {
            return Err("Unsupported Helper Thoughts settings version.".into());
        }
        settings.validate()?;
        storage::write(path, &settings)
    }
    fn validate(self) -> Result<()> {
        if !(1..=30).contains(&self.min_minutes)
            || !(self.min_minutes..=30).contains(&self.max_minutes)
        {
            return Err("Helper Thoughts times must be 1–30 minutes, with minimum no greater than maximum. The file was not changed.".into());
        }
        Ok(())
    }
}
fn random_delay_ms(settings: Settings, sample: u64) -> u64 {
    (settings.min_minutes as u64
        + sample % (settings.max_minutes - settings.min_minutes + 1) as u64)
        * 60_000
}
pub struct Runtime {
    settings: Settings,
    due: Option<Instant>,
    mini_expires: Option<Instant>,
    pub mirror_x: bool,
    pub pending: bool,
    pub revealed: bool,
}
impl Default for Runtime {
    fn default() -> Self {
        Self {
            settings: Settings::default(),
            due: None,
            mini_expires: None,
            mirror_x: false,
            pending: false,
            revealed: false,
        }
    }
}
impl Runtime {
    pub fn configure(&mut self, settings: Settings) {
        self.settings = settings;
        self.dismiss();
    }
    fn dismiss(&mut self) {
        self.due = None;
        self.mini_expires = None;
        self.pending = false;
        self.revealed = false;
    }
    fn poll(&mut self, now: Instant, delay: Duration, paused: bool) {
        if !self.settings.active() {
            self.dismiss();
            return;
        }
        if self.pending {
            if !self.revealed && self.mini_expires.is_some_and(|expires| now >= expires) {
                self.dismiss();
            } else {
                return;
            }
        }
        if paused {
            if !self.pending {
                self.due = None;
            }
            return;
        }
        let due = *self.due.get_or_insert(now + delay);
        if now >= due {
            self.pending = true;
            self.due = None;
        }
    }
    pub fn shown(&mut self, now: Instant) {
        if self.pending && !self.revealed && self.mini_expires.is_none() {
            self.mini_expires = Some(now + Duration::from_secs(120));
        }
    }
    fn reveal(&mut self, now: Instant) {
        if self.mini_expires.is_some_and(|expires| now >= expires) {
            self.dismiss();
        } else if self.pending && self.settings.active() {
            self.revealed = true;
            self.mini_expires = None;
        }
    }
}
#[derive(Serialize)]
pub struct View {
    settings: Settings,
    pending: bool,
    revealed: bool,
}

#[tauri::command]
pub fn thought_settings(state: tauri::State<'_, AppState>) -> Result<Settings> {
    let _guard = state.serial.lock().map_err(|_| "Storage lock failed")?;
    Settings::load(&state.root.join("helper-thoughts.json"))
}
#[tauri::command]
pub fn save_thought_settings(app: AppHandle, settings: Settings) -> Result<()> {
    let state = app.state::<AppState>();
    let _guard = state.serial.lock().map_err(|_| "Storage lock failed")?;
    Settings::save(&state.root.join("helper-thoughts.json"), settings)?;
    state
        .thoughts
        .lock()
        .map_err(|_| "Thought state lock failed")?
        .configure(settings);
    app.get_webview_window("thought")
        .ok_or("Thought window missing")?
        .hide()
        .map_err(|e| e.to_string())?;
    app.emit_to("thought", "thoughts-changed", ())
        .map_err(|e| e.to_string())
}
#[tauri::command]
pub fn thought_poll(app: AppHandle) -> Result<View> {
    use std::hash::{BuildHasher, Hasher};
    let mut random = std::collections::hash_map::RandomState::new().build_hasher();
    random.write(b"Little Helper thought wait");
    let state = app.state::<AppState>();
    let paused = state.minimized.load(Ordering::SeqCst);
    let mut runtime = state
        .thoughts
        .lock()
        .map_err(|_| "Thought state lock failed")?;
    let was_pending = runtime.pending;
    let delay_ms = random_delay_ms(runtime.settings, random.finish());
    runtime.poll(Instant::now(), Duration::from_millis(delay_ms), paused);
    let view = View {
        settings: runtime.settings,
        pending: runtime.pending,
        revealed: runtime.revealed,
    };
    drop(runtime);
    if view.pending != was_pending {
        app.emit_to("thought", "thoughts-changed", ())
            .map_err(|e| e.to_string())?;
    }
    if !view.pending || paused {
        app.get_webview_window("thought")
            .ok_or("Thought window missing")?
            .hide()
            .map_err(|e| e.to_string())?;
    }
    Ok(view)
}
// Keep the clock native: hidden WebViews may throttle or suspend JavaScript timers.
pub fn install(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(1));
        let state = app.state::<AppState>();
        if state.thought_tick_pending.swap(true, Ordering::SeqCst) {
            continue;
        }
        let copy = app.clone();
        if app
            .run_on_main_thread(move || {
                if let Err(error) = thought_poll(copy.clone()) {
                    crate::report(&copy, error);
                }
                copy.state::<AppState>()
                    .thought_tick_pending
                    .store(false, Ordering::SeqCst);
            })
            .is_err()
        {
            break;
        }
    });
}
#[tauri::command]
pub fn reveal_thought(state: tauri::State<'_, AppState>) -> Result<()> {
    let mut runtime = state
        .thoughts
        .lock()
        .map_err(|_| "Thought state lock failed")?;
    runtime.reveal(Instant::now());
    Ok(())
}
#[tauri::command]
pub fn dismiss_thought(app: AppHandle) -> Result<()> {
    app.state::<AppState>()
        .thoughts
        .lock()
        .map_err(|_| "Thought state lock failed")?
        .dismiss();
    app.get_webview_window("thought")
        .ok_or("Thought window missing")?
        .hide()
        .map_err(|e| e.to_string())
}
pub fn active(app: &AppHandle) -> Result<bool> {
    let state = app.state::<AppState>();
    // Release the guard before any window query: those may marshal to the UI
    // thread, whose native timer also needs the thought-state lock.
    let pending = state
        .thoughts
        .lock()
        .map_err(|_| "Thought state lock failed")?
        .pending;
    Ok(!state.minimized.load(Ordering::SeqCst)
        && !state.choices_open.load(Ordering::SeqCst)
        && !app
            .get_webview_window("panel")
            .is_some_and(|window| window.is_visible().unwrap_or(false))
        && pending
        && app
            .get_webview_window("mascot")
            .ok_or("Mascot missing")?
            .is_visible()
            .map_err(|e| e.to_string())?)
}
// Place alongside, then above/below. Never cover the sprite, even on tiny work areas.
fn placement(m: [i32; 4], a: [i32; 4], size: [i32; 2]) -> Option<[i32; 2]> {
    let [x, y, w, h] = m;
    let [ax, ay, aw, ah] = a;
    let [bw, bh] = size;
    if bw > aw || bh > ah {
        return None;
    }
    // A little clearance below the work-area top keeps the cloud from hugging
    // the edge. Move only the bubble; never alter the mascot's saved position.
    let top = ay + 8.min(ah - bh);
    let cy = (y + h / 3 - bh + 8).clamp(top, ay + ah - bh);
    let cx = (x + (w - bw) / 2).clamp(ax, ax + aw - bw);
    // The mascot and cloud have transparent edge padding. Bring the windows
    // slightly into that padding; their alpha regions keep visible input apart.
    let gap = -(w / 10);
    [
        [x + w + gap, cy],
        [x - bw - gap, cy],
        [cx, y - bh - 8],
        [cx, y + h + 8],
    ]
    .into_iter()
    .find(|[bx, by]| *bx >= ax && *by >= top && bx + bw <= ax + aw && by + bh <= ay + ah)
}
pub fn follow(app: &AppHandle) -> Result<bool> {
    let window = app
        .get_webview_window("thought")
        .ok_or("Thought window missing")?;
    if !active(app)? {
        window.hide().map_err(|e| e.to_string())?;
        return Ok(false);
    }
    let mascot = app.get_webview_window("mascot").ok_or("Mascot missing")?;
    let monitor = mascot
        .current_monitor()
        .map_err(|e| e.to_string())?
        .ok_or("No mascot monitor")?;
    let p = mascot.outer_position().map_err(|e| e.to_string())?;
    let s = mascot.outer_size().map_err(|e| e.to_string())?;
    let b = window.outer_size().map_err(|e| e.to_string())?;
    let a = monitor.work_area();
    if let Some([x, y]) = placement(
        [p.x, p.y, s.width as i32, s.height as i32],
        [
            a.position.x,
            a.position.y,
            a.size.width as i32,
            a.size.height as i32,
        ],
        [b.width as i32, b.height as i32],
    ) {
        let mirror_x = x + b.width as i32 <= p.x + s.width as i32 / 10;
        let changed = {
            let state = app.state::<AppState>();
            let mut runtime = state
                .thoughts
                .lock()
                .map_err(|_| "Thought state lock failed")?;
            let changed = runtime.mirror_x != mirror_x;
            runtime.mirror_x = mirror_x;
            changed
        };
        // Hide the old shape until its mirrored alpha and controls are ready.
        if changed {
            window.hide().map_err(|e| e.to_string())?;
        }
        let target = PhysicalPosition::new(x, y);
        if window.outer_position().map_err(|e| e.to_string())? != target {
            window.set_position(target).map_err(|e| e.to_string())?;
        }
        if changed {
            app.emit_to("thought", "thoughts-changed", ())
                .map_err(|e| e.to_string())?;
        }
        Ok(true)
    } else {
        window.hide().map_err(|e| e.to_string())?;
        Ok(false)
    }
}

#[tauri::command]
pub fn size_thought(app: AppHandle, width: u32, height: u32) -> Result<()> {
    if !(96..=280).contains(&width) || !(96..=224).contains(&height) {
        return Err("Thought content dimensions are out of range.".into());
    }
    let window = app
        .get_webview_window("thought")
        .ok_or("Thought window missing")?;
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let size = window
        .inner_size()
        .map_err(|e| e.to_string())?
        .to_logical::<f64>(scale);
    if (size.width - width as f64).abs() > 0.75 || (size.height - height as f64).abs() > 0.75 {
        window.hide().map_err(|e| e.to_string())?;
        window
            .set_size(tauri::LogicalSize::new(width, height))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn interval_defaults_upgrade_old_settings_and_random_whole_minutes_respect_bounds() {
        let old = br#"{"version":1,"enabled":true,"jokes":true,"facts":false,"motivation":true}"#;
        let s: Settings = serde_json::from_slice(old).unwrap();
        assert_eq!((s.min_minutes, s.max_minutes), (3, 10));
        let s = Settings {
            min_minutes: 1,
            max_minutes: 30,
            ..s
        };
        for n in 0..1000 {
            let ms = random_delay_ms(s, n);
            assert!((60_000..=1_800_000).contains(&ms));
            assert_eq!(ms % 60_000, 0);
        }
        assert_eq!(random_delay_ms(s, 0), 60_000);
        assert_eq!(random_delay_ms(s, 29), 1_800_000);
        for n in [0, 1, 99, u64::MAX] {
            assert_eq!(
                random_delay_ms(
                    Settings {
                        min_minutes: 7,
                        max_minutes: 7,
                        ..s
                    },
                    n
                ),
                420_000
            );
        }
    }
    #[test]
    fn invalid_intervals_preserve_saved_bytes_and_updates_cancel_old_wait() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("helper-thoughts.json");
        Settings::save(&p, Settings::default()).unwrap();
        let before = std::fs::read(&p).unwrap();
        for (min, max) in [(0, 10), (1, 31), (12, 3)] {
            assert!(Settings::save(
                &p,
                Settings {
                    min_minutes: min,
                    max_minutes: max,
                    ..Settings::default()
                }
            )
            .is_err());
            assert_eq!(std::fs::read(&p).unwrap(), before);
        }
        let mut r = Runtime::default();
        let now = Instant::now();
        r.configure(Settings {
            enabled: true,
            ..Settings::default()
        });
        r.poll(now, Duration::from_secs(600), false);
        r.configure(Settings {
            enabled: true,
            min_minutes: 1,
            max_minutes: 1,
            ..Settings::default()
        });
        assert!(r.due.is_none());
        r.poll(
            now,
            Duration::from_millis(random_delay_ms(r.settings, 0)),
            false,
        );
        assert_eq!(r.due, Some(now + Duration::from_secs(60)));
    }
    #[test]
    fn ignored_mini_expires_two_minutes_after_showing_and_restarts_random_wait() {
        let mut r = Runtime::default();
        let now = Instant::now();
        let delay = Duration::from_secs(180);
        r.configure(Settings {
            enabled: true,
            ..Settings::default()
        });
        r.poll(now, delay, false);
        r.poll(now + delay, delay, false);
        assert!(r.pending && !r.revealed);
        // A pending thought hidden behind an open menu has not appeared yet.
        r.poll(now + delay * 3, delay, false);
        assert!(r.pending && r.mini_expires.is_none());
        let shown = now + delay * 3;
        r.shown(shown);
        r.shown(shown + Duration::from_secs(60));
        r.poll(shown + Duration::from_secs(119), delay, false);
        assert!(r.pending);
        let expired = shown + Duration::from_secs(120);
        r.poll(expired, delay, false);
        assert!(!r.pending && !r.revealed && r.mini_expires.is_none());
        assert_eq!(r.due, Some(expired + delay));
        r.poll(expired + delay - Duration::from_secs(1), delay, false);
        assert!(!r.pending);
        r.poll(expired + delay, delay, false);
        assert!(r.pending && !r.revealed && r.mini_expires.is_none());
    }
    #[test]
    fn clicking_mini_reveals_message_without_expiry_but_expired_click_is_rejected() {
        let mut r = Runtime::default();
        let now = Instant::now();
        let delay = Duration::from_secs(180);
        r.configure(Settings {
            enabled: true,
            ..Settings::default()
        });
        r.poll(now, delay, false);
        r.poll(now + delay, delay, false);
        r.shown(now + delay);
        r.reveal(now + delay + Duration::from_secs(119));
        r.poll(now + delay * 10, delay, false);
        assert!(r.pending && r.revealed && r.mini_expires.is_none());
        r.dismiss();
        r.poll(now + delay * 10, delay, false);
        r.poll(now + delay * 11, delay, false);
        r.shown(now + delay * 11);
        r.reveal(now + delay * 11 + Duration::from_secs(120));
        assert!(!r.pending && !r.revealed);
    }
    #[test]
    fn mini_expiry_during_tray_pause_does_not_schedule_until_restored() {
        let mut r = Runtime::default();
        let now = Instant::now();
        let delay = Duration::from_secs(600);
        r.configure(Settings {
            enabled: true,
            ..Settings::default()
        });
        r.poll(now, delay, false);
        r.poll(now + delay, delay, false);
        r.shown(now + delay);
        let later = now + delay + Duration::from_secs(120);
        r.poll(later, delay, true);
        assert!(!r.pending && r.due.is_none());
        r.poll(later, delay, false);
        assert_eq!(r.due, Some(later + delay));
        r.configure(Settings::default());
        assert!(r.due.is_none() && r.mini_expires.is_none());
    }
    #[test]
    fn defaults_and_all_categories_off_never_schedule() {
        let mut r = Runtime::default();
        let now = Instant::now();
        let delay = Duration::from_secs(180);
        r.poll(now, delay, false);
        r.poll(now + Duration::from_secs(900), delay, false);
        assert!(!r.pending && r.due.is_none());
        r.configure(Settings {
            enabled: true,
            jokes: false,
            facts: false,
            motivation: false,
            ..Settings::default()
        });
        r.poll(now, delay, false);
        assert!(r.due.is_none());
    }
    #[test]
    fn wait_pending_dismiss_and_off_cancel() {
        let mut r = Runtime::default();
        let now = Instant::now();
        let delay = Duration::from_secs(600);
        r.configure(Settings {
            enabled: true,
            ..Settings::default()
        });
        r.poll(now, delay, false);
        r.poll(now + Duration::from_secs(599), delay, false);
        assert!(!r.pending);
        r.poll(now + delay, delay, false);
        assert!(r.pending);
        r.revealed = true;
        r.poll(now + delay * 2, delay, false);
        assert!(r.pending && r.revealed);
        r.dismiss();
        r.poll(now + delay * 2, delay, false);
        assert!(!r.pending && r.due.is_some());
        r.configure(Settings::default());
        assert!(r.due.is_none() && !r.pending && !r.revealed);
    }
    #[test]
    fn tray_pause_does_not_queue_catch_up_bubbles() {
        let mut r = Runtime::default();
        let now = Instant::now();
        let delay = Duration::from_secs(180);
        r.configure(Settings {
            enabled: true,
            ..Settings::default()
        });
        r.poll(now, delay, false);
        r.poll(now + delay, delay, true);
        assert!(!r.pending && r.due.is_none());
        r.poll(now + delay * 2, delay, false);
        assert!(!r.pending);
        r.poll(now + delay * 3, delay, false);
        assert!(r.pending);
    }
    #[test]
    fn settings_persist_and_malformed_or_unreadable_files_are_preserved() {
        let d = tempfile::tempdir().unwrap();
        let p = d.path().join("helper-thoughts.json");
        assert_eq!(Settings::load(&p).unwrap(), Settings::default());
        let s = Settings {
            enabled: true,
            facts: false,
            ..Settings::default()
        };
        Settings::save(&p, s).unwrap();
        assert_eq!(Settings::load(&p).unwrap(), s);
        std::fs::write(&p, b"broken").unwrap();
        assert!(Settings::save(&p, s).is_err());
        assert_eq!(std::fs::read(&p).unwrap(), b"broken");
        assert!(Settings::load(d.path()).is_err());
    }
    #[test]
    fn placement_stays_reachable_without_covering_sprite() {
        for m in [
            [0, 0, 128, 128],
            [1870, 900, 128, 128],
            [-1900, 0, 128, 128],
            [850, 400, 128, 128],
        ] {
            let a = if m[0] < 0 {
                [-1920, 0, 1920, 1080]
            } else {
                [0, 0, 2000, 1080]
            };
            let [x, y] = placement(m, a, [280, 144]).unwrap();
            assert!(x >= a[0] && y >= a[1] && x + 280 <= a[0] + a[2] && y + 144 <= a[1] + a[3]);
            // Transparent window padding may overlap; the mascot's central
            // visible body remains clear of the entire thought window.
            assert!(
                x >= m[0] + m[2] - m[2] / 8
                    || x + 280 <= m[0] + m[2] / 8
                    || y >= m[1] + m[3]
                    || y + 144 <= m[1]
            );
        }
        assert!(placement([0, 0, 128, 128], [0, 0, 128, 128], [280, 144]).is_none());
    }
    #[test]
    fn mini_reflection_keeps_equal_spacing_and_points_its_tail_toward_the_sprite() {
        let area = [0, 0, 1920, 1080];
        let size = [96, 96];
        let right_sprite = [80, 400, 128, 128];
        let left_sprite = [1792, 400, 128, 128];
        let right = placement(right_sprite, area, size).unwrap();
        let left = placement(left_sprite, area, size).unwrap();
        assert_eq!(right[0], right_sprite[0] + 128 - 12);
        assert_eq!(left[0] + 96, left_sprite[0] + 12);
        // The compact cloud spans x=10..86 on both sides; its tail reflects.
        assert_eq!(
            (right[0] + 10) - (right_sprite[0] + 128),
            left_sprite[0] - (left[0] + 86)
        );
        assert_eq!(
            (right[0] + 14) - (right_sprite[0] + 128),
            left_sprite[0] - (left[0] + 82)
        );
        // The original seed artwork has about 18 px of side padding.
        let old_visible_gap = 8 + 18 + 14;
        let new_visible_gap = (right[0] + 14) - (right_sprite[0] + 128 - 18);
        assert!((new_visible_gap * 2 - old_visible_gap).abs() <= 2);
    }
    #[test]
    fn top_edge_shifts_only_the_bubble_down_with_clearance_on_either_side() {
        for sprite in [
            [0, 0, 128, 128],
            [1792, 0, 128, 128],
            [-1920, -200, 128, 128],
        ] {
            let area = if sprite[0] < 0 {
                [-1920, -200, 1920, 1080]
            } else {
                [0, 0, 1920, 1080]
            };
            let point = placement(sprite, area, [280, 144]).unwrap();
            assert_eq!(point[1], area[1] + 8);
            assert_eq!(sprite[1], area[1]);
        }
    }
    #[test]
    fn tail_anchors_near_upper_body_for_compact_and_expanded_sizes() {
        let sprite = [500, 400, 128, 128];
        let area = [0, 0, 1920, 1080];
        for size in [[96, 96], [180, 101], [280, 118], [280, 154]] {
            let point = placement(sprite, area, size).unwrap();
            let tail = point[1] + size[1] - 8;
            assert_eq!(tail, sprite[1] + sprite[3] / 3);
            assert!(tail < sprite[1] + sprite[3] / 2);
        }
    }
}
