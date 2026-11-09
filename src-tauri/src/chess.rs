//! Local chess settings and the five most recent PGN logs. No engine or UI here.
use crate::storage::{self, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, io::Write, path::Path};

pub const MIN_ELO: u16 = 200;
pub const MAX_ELO: u16 = 3190;
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RatingMode {
    Adaptive,
    Preset,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Settings {
    pub mode: RatingMode,
    pub adaptive_elo: u16,
    pub preset_elo: u16,
    pub win_step: u16,
    pub loss_step: u16,
}
impl Settings {
    pub fn elo(&self) -> u16 {
        if self.mode == RatingMode::Adaptive {
            self.adaptive_elo
        } else {
            self.preset_elo
        }
    }
}
impl Default for Settings {
    fn default() -> Self {
        Self {
            mode: RatingMode::Preset,
            adaptive_elo: 800,
            preset_elo: 800,
            win_step: 5,
            loss_step: 5,
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Color {
    White,
    Black,
}
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Outcome {
    InProgress,
    Win,
    Loss,
    Draw,
    Aborted,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Options {
    pub player: Color,
    pub minutes: u16,
    pub increment: u16,
    pub energy: u8,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Game {
    pub id: u64,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub elo: u16,
    pub adaptive: bool,
    pub win_step: u16,
    pub loss_step: u16,
    pub options: Options,
    pub outcome: Outcome,
    pub pgn: String,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Store {
    version: u8,
    next_id: u64,
    pub settings: Settings,
    pub games: Vec<Game>,
}
impl Default for Store {
    fn default() -> Self {
        Self {
            version: 1,
            next_id: 1,
            settings: Settings::default(),
            games: vec![],
        }
    }
}
fn validate_settings(settings: &Settings) -> Result<()> {
    if !(MIN_ELO..=MAX_ELO).contains(&settings.adaptive_elo)
        || !(MIN_ELO..=MAX_ELO).contains(&settings.preset_elo)
        || !(1..=200).contains(&settings.win_step)
        || !(1..=200).contains(&settings.loss_step)
    {
        return Err("Chess Elo must be between 200 and 3190; gains and losses must be between 1 and 200 points.".into());
    }
    Ok(())
}
fn validate_options(options: &Options) -> Result<()> {
    if !(1..=3).contains(&options.energy)
        || options.minutes > 180
        || options.increment > 60
        || (options.minutes == 0 && options.increment != 0)
    {
        return Err("Invalid chess color, timer, or Helper energy.".into());
    }
    Ok(())
}
fn validate_pgn(pgn: &str) -> Result<()> {
    if pgn.len() > 131_072 || pgn.contains('\0') {
        return Err("Chess move log is too large or contains invalid text.".into());
    }
    Ok(())
}
impl Store {
    pub fn load(path: &Path) -> Result<Self> {
        let store: Self = storage::read(path)?.unwrap_or_default();
        let valid = || -> Result<()> {
            validate_settings(&store.settings)?;
            if store.version != 1 || store.games.len() > 5 || store.next_id == 0 {
                return Err("Invalid chess storage version or history length.".into());
            }
            let mut ids = HashSet::new();
            for game in &store.games {
                if game.id == 0
                    || game.id >= store.next_id
                    || !ids.insert(game.id)
                    || !(MIN_ELO..=MAX_ELO).contains(&game.elo)
                    || !(1..=200).contains(&game.win_step)
                    || !(1..=200).contains(&game.loss_step)
                    || chrono::DateTime::parse_from_rfc3339(&game.started_at).is_err()
                    || game
                        .finished_at
                        .as_ref()
                        .is_some_and(|date| chrono::DateTime::parse_from_rfc3339(date).is_err())
                    || (game.outcome == Outcome::InProgress) != game.finished_at.is_none()
                {
                    return Err("Invalid chess game record.".into());
                }
                validate_options(&game.options)?;
                validate_pgn(&game.pgn)?;
            }
            Ok(())
        };
        valid().map_err(|error| {
            format!(
                "Invalid chess data in {}: {error} The file was not changed.",
                path.display()
            )
        })?;
        Ok(store)
    }
    pub fn save_settings(path: &Path, settings: Settings) -> Result<Self> {
        validate_settings(&settings)?;
        let mut store = Self::load(path)?;
        store.settings = settings;
        storage::write(path, &store)?;
        Ok(store)
    }
    pub fn begin(path: &Path, options: Options) -> Result<Game> {
        validate_options(&options)?;
        let mut store = Self::load(path)?;
        if store
            .games
            .iter()
            .any(|game| game.outcome == Outcome::InProgress)
        {
            return Err("Finish or abandon the current chess game first.".into());
        }
        let game = Game {
            id: store.next_id,
            started_at: Utc::now().to_rfc3339(),
            finished_at: None,
            elo: store.settings.elo(),
            adaptive: store.settings.mode == RatingMode::Adaptive,
            win_step: store.settings.win_step,
            loss_step: store.settings.loss_step,
            options,
            outcome: Outcome::InProgress,
            pgn: String::new(),
        };
        store.next_id = store
            .next_id
            .checked_add(1)
            .ok_or("Chess identifiers exhausted")?;
        store.games.push(game.clone());
        if store.games.len() > 5 {
            store.games.remove(0);
        }
        storage::write(path, &store)?;
        Ok(game)
    }
    pub fn progress(path: &Path, id: u64, pgn: String) -> Result<()> {
        validate_pgn(&pgn)?;
        let mut store = Self::load(path)?;
        let game = store
            .games
            .iter_mut()
            .find(|game| game.id == id)
            .ok_or("Chess game not found")?;
        if game.outcome != Outcome::InProgress {
            return Err("This chess game has already finished.".into());
        }
        game.pgn = pgn;
        storage::write(path, &store)
    }
    pub fn finish(path: &Path, id: u64, outcome: Outcome, pgn: String) -> Result<Self> {
        if outcome == Outcome::InProgress {
            return Err("Choose a finished chess result.".into());
        }
        validate_pgn(&pgn)?;
        let mut store = Self::load(path)?;
        let game = store
            .games
            .iter_mut()
            .find(|game| game.id == id)
            .ok_or("Chess game not found")?;
        if game.outcome != Outcome::InProgress {
            if game.outcome == outcome && game.pgn == pgn {
                return Ok(store);
            }
            return Err("This chess game has already finished.".into());
        }
        game.pgn = pgn;
        game.outcome = outcome;
        game.finished_at = Some(Utc::now().to_rfc3339());
        if game.adaptive {
            store.settings.adaptive_elo = match outcome {
                Outcome::Win => store
                    .settings
                    .adaptive_elo
                    .saturating_add(game.win_step)
                    .min(MAX_ELO),
                Outcome::Loss => store
                    .settings
                    .adaptive_elo
                    .saturating_sub(game.loss_step)
                    .max(MIN_ELO),
                _ => store.settings.adaptive_elo,
            };
        }
        storage::write(path, &store)?;
        Ok(store)
    }
    pub fn recover(path: &Path) -> Result<()> {
        let mut store = Self::load(path)?;
        let mut changed = false;
        for game in &mut store.games {
            if game.outcome == Outcome::InProgress {
                game.outcome = Outcome::Aborted;
                game.finished_at = Some(Utc::now().to_rfc3339());
                changed = true;
            }
        }
        if changed {
            storage::write(path, &store)?;
        }
        Ok(())
    }
}
pub fn export(path: &Path, downloads: &Path, id: u64) -> Result<String> {
    let store = Store::load(path)?;
    let game = store
        .games
        .iter()
        .find(|game| game.id == id)
        .ok_or("Chess game not found")?;
    std::fs::create_dir_all(downloads).map_err(|e| e.to_string())?;
    for suffix in 0..1000 {
        let name = if suffix == 0 {
            format!("Little-Helper-chess-{}.pgn", game.id)
        } else {
            format!("Little-Helper-chess-{}-{suffix}.pgn", game.id)
        };
        let destination = downloads.join(name);
        match std::fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .open(&destination)
        {
            Ok(mut file) => {
                file.write_all(game.pgn.as_bytes())
                    .and_then(|_| file.sync_all())
                    .map_err(|e| format!("Cannot export chess log: {e}"))?;
                return Ok(destination.display().to_string());
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(format!("Cannot export chess log: {error}")),
        }
    }
    Err("Too many existing chess exports for this game.".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn options() -> Options {
        Options {
            player: Color::White,
            minutes: 0,
            increment: 0,
            energy: 2,
        }
    }
    #[test]
    fn defaults_and_manual_settings_persist() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("chess.json");
        assert_eq!(Store::load(&path).unwrap().settings.elo(), 800);
        Store::save_settings(
            &path,
            Settings {
                preset_elo: 250,
                ..Settings::default()
            },
        )
        .unwrap();
        assert_eq!(Store::load(&path).unwrap().settings.elo(), 250);
        assert!(Store::save_settings(
            &path,
            Settings {
                preset_elo: 199,
                ..Settings::default()
            }
        )
        .is_err());
        assert_eq!(Store::load(&path).unwrap().settings.elo(), 250);
    }
    #[test]
    fn retains_latest_five_logs_and_stable_ids() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("chess.json");
        for _ in 0..8 {
            let game = Store::begin(&path, options()).unwrap();
            Store::progress(&path, game.id, "1. e4 *".into()).unwrap();
            Store::finish(&path, game.id, Outcome::Draw, "1. e4 1/2-1/2".into()).unwrap();
        }
        let store = Store::load(&path).unwrap();
        assert_eq!(
            store.games.iter().map(|game| game.id).collect::<Vec<_>>(),
            [4, 5, 6, 7, 8]
        );
    }
    #[test]
    fn adaptive_changes_follow_human_result_only_once_and_respect_bounds() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("chess.json");
        Store::save_settings(
            &path,
            Settings {
                adaptive_elo: 3190,
                mode: RatingMode::Adaptive,
                ..Settings::default()
            },
        )
        .unwrap();
        for (outcome, expected) in [
            (Outcome::Win, 3190),
            (Outcome::Loss, 3185),
            (Outcome::Draw, 3185),
            (Outcome::Aborted, 3185),
        ] {
            let game = Store::begin(&path, options()).unwrap();
            Store::finish(&path, game.id, outcome, "*".into()).unwrap();
            Store::finish(&path, game.id, outcome, "*".into()).unwrap();
            assert_eq!(Store::load(&path).unwrap().settings.adaptive_elo, expected);
        }
        Store::save_settings(
            &path,
            Settings {
                adaptive_elo: 200,
                mode: RatingMode::Adaptive,
                ..Settings::default()
            },
        )
        .unwrap();
        let game = Store::begin(&path, options()).unwrap();
        Store::finish(&path, game.id, Outcome::Loss, "*".into()).unwrap();
        assert_eq!(Store::load(&path).unwrap().settings.adaptive_elo, 200);
    }
    #[test]
    fn frozen_game_settings_and_current_manual_rating_are_preserved() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("chess.json");
        Store::save_settings(
            &path,
            Settings {
                mode: RatingMode::Adaptive,
                win_step: 17,
                loss_step: 3,
                ..Settings::default()
            },
        )
        .unwrap();
        let game = Store::begin(&path, options()).unwrap();
        Store::save_settings(
            &path,
            Settings {
                adaptive_elo: 1000,
                preset_elo: 600,
                ..Settings::default()
            },
        )
        .unwrap();
        let store = Store::finish(&path, game.id, Outcome::Win, "1-0".into()).unwrap();
        assert_eq!(store.games[0].elo, 800);
        assert_eq!(store.settings.adaptive_elo, 1017);
        assert_eq!(store.settings.preset_elo, 600);
    }
    #[test]
    fn interrupted_game_keeps_moves_without_rating_change() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("chess.json");
        let game = Store::begin(&path, options()).unwrap();
        Store::progress(&path, game.id, "1. e4 e5 *".into()).unwrap();
        assert!(Store::begin(&path, options()).is_err());
        Store::recover(&path).unwrap();
        let store = Store::load(&path).unwrap();
        assert_eq!(store.games[0].outcome, Outcome::Aborted);
        assert_eq!(store.games[0].pgn, "1. e4 e5 *");
    }
    #[test]
    fn malformed_file_and_invalid_edits_do_not_overwrite_data() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("chess.json");
        std::fs::write(&path, "{broken").unwrap();
        assert!(Store::begin(&path, options()).is_err());
        assert!(Store::recover(&path).is_err());
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "{broken");
        assert!(validate_options(&Options {
            energy: 4,
            ..options()
        })
        .is_err());
    }
    #[test]
    fn export_writes_pgn_without_overwriting_existing_files() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("chess.json");
        let downloads = dir.path().join("downloads");
        let game = Store::begin(&path, options()).unwrap();
        Store::finish(&path, game.id, Outcome::Draw, "1/2-1/2".into()).unwrap();
        let first = export(&path, &downloads, game.id).unwrap();
        let second = export(&path, &downloads, game.id).unwrap();
        assert_ne!(first, second);
        assert_eq!(std::fs::read_to_string(first).unwrap(), "1/2-1/2");
    }
}
