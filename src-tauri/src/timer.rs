use crate::storage::Result;
use serde::{Deserialize, Serialize};
use std::{sync::OnceLock, time::Instant};

pub fn now_ms() -> u64 {
    static EPOCH: OnceLock<Instant> = OnceLock::new();
    EPOCH
        .get_or_init(Instant::now)
        .elapsed()
        .as_millis()
        .min(u64::MAX as u128) as u64
}
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Mode {
    Normal,
    Pomodoro,
    Stopwatch,
}
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Idle,
    Running,
    Paused,
    Complete,
}
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Kind {
    Countdown,
    Work,
    Break,
}
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    pub normal_seconds: u32,
    pub work_seconds: u32,
    pub break_seconds: u32,
    pub decrease_seconds: u32,
    pub rounds: u32,
}
impl Default for Config {
    fn default() -> Self {
        Self {
            normal_seconds: 1500,
            work_seconds: 1500,
            break_seconds: 300,
            decrease_seconds: 0,
            rounds: 4,
        }
    }
}
#[derive(Clone, Debug)]
struct Phase {
    kind: Kind,
    round: u32,
    ms: u64,
}
fn plan(mode: Mode, c: &Config) -> Result<Vec<Phase>> {
    match mode {
        Mode::Stopwatch => Ok(vec![]),
        Mode::Normal => {
            if !(1..=86400).contains(&c.normal_seconds) {
                return Err("Normal duration must be between 1 second and 24 hours.".into());
            }
            Ok(vec![Phase {
                kind: Kind::Countdown,
                round: 1,
                ms: c.normal_seconds as u64 * 1000,
            }])
        }
        Mode::Pomodoro => {
            if !(1..=86400).contains(&c.work_seconds)
                || !(1..=86400).contains(&c.break_seconds)
                || c.decrease_seconds > 86400
                || !(1..=100).contains(&c.rounds)
            {
                return Err("Work and break times must be 1 second–24 hours, decrease 0–24 hours, and rounds 1–100.".into());
            }
            let reduction = c.decrease_seconds as u64 * (c.rounds - 1) as u64;
            if reduction >= c.work_seconds as u64 {
                return Err("The decrease would make a work period zero or negative. Reduce the decrease or number of rounds.".into());
            }
            let mut phases = Vec::new();
            for round in 1..=c.rounds {
                phases.push(Phase {
                    kind: Kind::Work,
                    round,
                    ms: (c.work_seconds as u64 - c.decrease_seconds as u64 * (round - 1) as u64)
                        * 1000,
                });
                if round < c.rounds {
                    phases.push(Phase {
                        kind: Kind::Break,
                        round,
                        ms: c.break_seconds as u64 * 1000,
                    });
                }
            }
            Ok(phases)
        }
    }
}
#[derive(Serialize, Debug)]
pub struct View {
    pub mode: Mode,
    pub status: Status,
    pub config: Config,
    pub elapsed_ms: u64,
    pub remaining_ms: Option<u64>,
    pub phase: Option<Kind>,
    pub round: u32,
    pub rounds: u32,
    pub total_ms: Option<u64>,
}
pub struct Clock {
    mode: Mode,
    status: Status,
    config: Config,
    phases: Vec<Phase>,
    elapsed: u64,
    started: Option<u64>,
}
impl Default for Clock {
    fn default() -> Self {
        let config = Config::default();
        let phases = plan(Mode::Normal, &config).expect("Valid timer defaults");
        Self {
            mode: Mode::Normal,
            status: Status::Idle,
            config,
            phases,
            elapsed: 0,
            started: None,
        }
    }
}
impl Clock {
    fn total(&self) -> Option<u64> {
        if self.mode == Mode::Stopwatch {
            None
        } else {
            Some(self.phases.iter().map(|p| p.ms).sum())
        }
    }
    fn advance(&mut self, now: u64) {
        if let Some(start) = self.started {
            self.elapsed = self.elapsed.saturating_add(now.saturating_sub(start));
            self.started = Some(start.max(now));
        }
        if self.status == Status::Running && self.total().is_some_and(|total| self.elapsed >= total)
        {
            self.elapsed = self.total().unwrap_or(0);
            self.status = Status::Complete;
            self.started = None;
        }
    }
    pub fn start(&mut self, mode: Mode, config: Config, now: u64) -> Result<View> {
        self.advance(now);
        if matches!(self.status, Status::Running | Status::Paused) {
            return Err("Reset the current timer before starting another.".into());
        }
        let phases = plan(mode, &config)?;
        self.mode = mode;
        self.config = config;
        self.phases = phases;
        self.elapsed = 0;
        self.started = Some(now);
        self.status = Status::Running;
        Ok(self.view(now))
    }
    pub fn pause(&mut self, now: u64) -> Result<View> {
        self.advance(now);
        if self.status == Status::Complete {
            return Ok(self.view(now));
        }
        if self.status != Status::Running {
            return Err("Only a running timer can be paused.".into());
        }
        self.started = None;
        self.status = Status::Paused;
        Ok(self.view(now))
    }
    pub fn resume(&mut self, now: u64) -> Result<View> {
        if self.status != Status::Paused {
            return Err("Only a paused timer can be resumed.".into());
        }
        self.started = Some(now);
        self.status = Status::Running;
        Ok(self.view(now))
    }
    pub fn reset(&mut self, now: u64) -> View {
        self.elapsed = 0;
        self.started = None;
        self.status = Status::Idle;
        self.view(now)
    }
    pub fn view(&mut self, now: u64) -> View {
        self.advance(now);
        let mut remaining_elapsed = self.elapsed;
        let mut selected = self.phases.last();
        for phase in &self.phases {
            if remaining_elapsed < phase.ms {
                selected = Some(phase);
                break;
            }
            remaining_elapsed = remaining_elapsed.saturating_sub(phase.ms);
        }
        let remaining_ms = if self.mode == Mode::Stopwatch {
            None
        } else if self.status == Status::Complete {
            Some(0)
        } else {
            selected.map(|p| p.ms.saturating_sub(remaining_elapsed))
        };
        View {
            mode: self.mode,
            status: self.status,
            config: self.config.clone(),
            elapsed_ms: self.elapsed,
            remaining_ms,
            phase: selected.map(|p| p.kind),
            round: selected.map_or(0, |p| p.round),
            rounds: if self.mode == Mode::Pomodoro {
                self.config.rounds
            } else {
                1
            },
            total_ms: self.total(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn normal_finishes_at_deadline_without_drifting_or_going_negative() {
        let mut c = Clock::default();
        let cfg = Config {
            normal_seconds: 2,
            ..Config::default()
        };
        c.start(Mode::Normal, cfg, 100).unwrap();
        assert_eq!(c.view(1099).remaining_ms, Some(1001));
        assert_eq!(c.view(2100).status, Status::Complete);
        assert_eq!(c.view(99999).remaining_ms, Some(0));
        assert_eq!(c.view(99999).elapsed_ms, 2000);
    }
    #[test]
    fn pause_resume_excludes_paused_time_and_reset_retains_configuration() {
        let mut c = Clock::default();
        let cfg = Config {
            normal_seconds: 10,
            ..Config::default()
        };
        c.start(Mode::Normal, cfg.clone(), 0).unwrap();
        c.pause(2500).unwrap();
        assert_eq!(c.view(20000).remaining_ms, Some(7500));
        c.resume(20000).unwrap();
        assert_eq!(c.view(22000).remaining_ms, Some(5500));
        let v = c.reset(23000);
        assert_eq!(v.status, Status::Idle);
        assert_eq!(v.remaining_ms, Some(10000));
        assert_eq!(v.config, cfg);
    }
    #[test]
    fn pomodoro_decreases_only_work_and_ends_after_last_work_period() {
        let cfg = Config {
            work_seconds: 10,
            break_seconds: 3,
            decrease_seconds: 2,
            rounds: 3,
            ..Config::default()
        };
        let p = plan(Mode::Pomodoro, &cfg).unwrap();
        assert_eq!(
            p.iter().map(|p| p.ms).collect::<Vec<_>>(),
            [10000, 3000, 8000, 3000, 6000]
        );
        assert_eq!(p.last().unwrap().kind, Kind::Work);
        let mut c = Clock::default();
        c.start(Mode::Pomodoro, cfg, 0).unwrap();
        assert_eq!(c.view(10000).phase, Some(Kind::Break));
        assert_eq!(c.view(13000).round, 2);
        assert_eq!(c.view(13000).remaining_ms, Some(8000));
        assert_eq!(c.view(30000).status, Status::Complete);
    }
    #[test]
    fn delayed_poll_catches_up_across_multiple_phases_and_completion() {
        let mut c = Clock::default();
        let cfg = Config {
            work_seconds: 10,
            break_seconds: 3,
            decrease_seconds: 2,
            rounds: 3,
            ..Config::default()
        };
        c.start(Mode::Pomodoro, cfg, 100).unwrap();
        let v = c.view(25100);
        assert_eq!(v.phase, Some(Kind::Work));
        assert_eq!(v.round, 3);
        assert_eq!(v.remaining_ms, Some(5000));
        assert_eq!(c.view(90000).status, Status::Complete);
    }
    #[test]
    fn stopwatch_runs_without_limit_and_handles_pause_and_reset() {
        let mut c = Clock::default();
        c.start(Mode::Stopwatch, Config::default(), 100).unwrap();
        let v = c.view(100000100);
        assert_eq!(v.elapsed_ms, 100000000);
        assert_eq!(v.remaining_ms, None);
        c.pause(100000100).unwrap();
        assert_eq!(c.view(200000100).elapsed_ms, 100000000);
        c.resume(200000100).unwrap();
        assert_eq!(c.view(200001100).elapsed_ms, 100001000);
        assert_eq!(c.reset(200001100).elapsed_ms, 0);
    }
    #[test]
    fn invalid_configs_do_not_replace_the_current_timer() {
        let mut c = Clock::default();
        for cfg in [
            Config {
                work_seconds: 5,
                decrease_seconds: 5,
                rounds: 2,
                ..Config::default()
            },
            Config {
                rounds: 0,
                ..Config::default()
            },
            Config {
                rounds: 101,
                ..Config::default()
            },
            Config {
                break_seconds: 0,
                ..Config::default()
            },
        ] {
            assert!(c.start(Mode::Pomodoro, cfg, 0).is_err());
            assert_eq!(c.view(0).status, Status::Idle);
        }
        assert!(c
            .start(
                Mode::Normal,
                Config {
                    normal_seconds: 0,
                    ..Config::default()
                },
                0
            )
            .is_err());
        c.start(Mode::Normal, Config::default(), 0).unwrap();
        assert!(c.start(Mode::Stopwatch, Config::default(), 1000).is_err());
        assert_eq!(c.view(1000).mode, Mode::Normal);
    }
    #[test]
    fn single_round_has_no_break_and_zero_decrease_keeps_work_lengths() {
        assert_eq!(
            plan(
                Mode::Pomodoro,
                &Config {
                    rounds: 1,
                    decrease_seconds: 86400,
                    ..Config::default()
                }
            )
            .unwrap()
            .len(),
            1
        );
        let p = plan(Mode::Pomodoro, &Config::default()).unwrap();
        assert_eq!(p.len(), 7);
        assert!(p
            .iter()
            .filter(|p| p.kind == Kind::Work)
            .all(|p| p.ms == 1500000));
    }
    #[test]
    fn backward_clock_samples_never_remove_elapsed_time() {
        let mut c = Clock::default();
        c.start(Mode::Stopwatch, Config::default(), 100).unwrap();
        assert_eq!(c.view(200).elapsed_ms, 100);
        assert_eq!(c.view(150).elapsed_ms, 100);
        assert_eq!(c.view(250).elapsed_ms, 150);
    }
}
