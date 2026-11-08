use crate::storage::{self, Result};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, path::Path};

pub const INITIAL: [&str; 5] = [
    "Play 1 game of chess",
    "Submit 2 internship applications",
    "Drink 2 big bottles of water a day",
    "Pursue 1 hobby for fun",
    "Read 10 pages",
];
pub fn local_date() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Habit {
    pub id: u64,
    pub text: String,
    pub order: usize,
    pub checked: bool,
}
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Habits {
    version: u32,
    next_id: u64,
    pub date: String,
    pub habits: Vec<Habit>,
}
#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Edit {
    Add { text: String },
    Rename { id: u64, text: String },
    Delete { id: u64, confirmed: bool },
    Move { id: u64, to: usize },
    Check { id: u64, checked: bool },
}
fn name(text: String) -> Result<String> {
    if text.trim().is_empty() {
        Err("Habit names cannot be empty.".into())
    } else {
        Ok(text.trim().to_string())
    }
}
impl Habits {
    pub fn initial(date: &str) -> Self {
        Self {
            version: 1,
            next_id: 6,
            date: date.into(),
            habits: INITIAL
                .iter()
                .enumerate()
                .map(|(i, text)| Habit {
                    id: i as u64 + 1,
                    text: (*text).into(),
                    order: i,
                    checked: false,
                })
                .collect(),
        }
    }
    fn validate(&self) -> Result<()> {
        if self.version != 1
            || self.next_id == 0
            || chrono::NaiveDate::parse_from_str(&self.date, "%Y-%m-%d").is_err()
        {
            return Err("Invalid habit file version or date; data was not changed.".into());
        }
        let mut ids = HashSet::new();
        for (index, h) in self.habits.iter().enumerate() {
            if h.id == 0
                || h.id >= self.next_id
                || !ids.insert(h.id)
                || h.order != index
                || h.text.trim().is_empty()
            {
                return Err(
                    "Invalid habit identifiers, names, or order; data was not changed.".into(),
                );
            }
        }
        Ok(())
    }
    pub fn reset_for(&mut self, date: &str) -> bool {
        if self.date == date {
            return false;
        }
        self.date = date.into();
        for habit in &mut self.habits {
            habit.checked = false;
        }
        true
    }
    pub fn load_for_date(path: &Path, date: &str) -> Result<Self> {
        let saved: Option<Self> = storage::read(path)?;
        let missing = saved.is_none();
        let mut state = saved.unwrap_or_else(|| Self::initial(date));
        state
            .validate()
            .map_err(|e| format!("{}: {e}", path.display()))?;
        let reset = state.reset_for(date);
        if missing || reset {
            storage::write(path, &state)?;
        }
        Ok(state)
    }
    fn index(&self, id: u64) -> Result<usize> {
        self.habits
            .iter()
            .position(|h| h.id == id)
            .ok_or_else(|| "Habit no longer exists. Reopen the tracker.".into())
    }
    pub fn edit(&mut self, edit: Edit) -> Result<()> {
        match edit {
            Edit::Add { text } => {
                let text = name(text)?;
                let next = self
                    .next_id
                    .checked_add(1)
                    .ok_or("Habit identifiers exhausted")?;
                self.habits.push(Habit {
                    id: self.next_id,
                    text,
                    order: self.habits.len(),
                    checked: false,
                });
                self.next_id = next;
            }
            Edit::Rename { id, text } => {
                let i = self.index(id)?;
                self.habits[i].text = name(text)?;
            }
            Edit::Check { id, checked } => {
                let i = self.index(id)?;
                self.habits[i].checked = checked;
            }
            Edit::Delete { id, confirmed } => {
                let i = self.index(id)?;
                if self.habits[i].checked && !confirmed {
                    return Err("Confirm deletion of this completed habit.".into());
                }
                self.habits.remove(i);
            }
            Edit::Move { id, to } => {
                let i = self.index(id)?;
                if to >= self.habits.len() {
                    return Err("Invalid habit position.".into());
                }
                let habit = self.habits.remove(i);
                self.habits.insert(to, habit);
            }
        }
        for (i, habit) in self.habits.iter_mut().enumerate() {
            habit.order = i;
        }
        Ok(())
    }
    pub fn update(path: &Path, edit: Edit, date: &str) -> Result<Self> {
        let mut state = Self::load_for_date(path, date)?;
        state.edit(edit)?;
        storage::write(path, &state)?;
        Ok(state)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    const TODAY: &str = "2026-11-08";
    #[test]
    fn first_use_loads_exact_five_initial_habits() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("habits.json");
        let h = Habits::load_for_date(&path, TODAY).unwrap();
        assert_eq!(
            h.habits.iter().map(|h| h.text.as_str()).collect::<Vec<_>>(),
            INITIAL
        );
        assert!(h.habits.iter().all(|h| !h.checked));
        assert!(path.exists());
    }
    #[test]
    fn edits_reorder_and_delete_preserve_stable_identifiers() {
        let mut h = Habits::initial(TODAY);
        h.edit(Edit::Add {
            text: "Walk".into(),
        })
        .unwrap();
        let id = h.habits[5].id;
        h.edit(Edit::Rename {
            id,
            text: "Take a walk".into(),
        })
        .unwrap();
        h.edit(Edit::Move { id, to: 0 }).unwrap();
        assert_eq!(h.habits[0].id, id);
        assert_eq!(h.habits[0].text, "Take a walk");
        assert_eq!(h.habits[1].id, 1);
        h.edit(Edit::Delete {
            id,
            confirmed: false,
        })
        .unwrap();
        h.edit(Edit::Add { text: "New".into() }).unwrap();
        assert!(h.habits.last().unwrap().id > id);
        let ids: HashSet<_> = h.habits.iter().map(|h| h.id).collect();
        assert_eq!(ids.len(), h.habits.len());
        assert!(h.habits.iter().enumerate().all(|(i, h)| h.order == i));
    }
    #[test]
    fn empty_add_and_rename_rejected_without_changing_state() {
        let mut h = Habits::initial(TODAY);
        assert!(h
            .edit(Edit::Add {
                text: " \n ".into()
            })
            .is_err());
        assert!(h
            .edit(Edit::Rename {
                id: 1,
                text: "\t".into()
            })
            .is_err());
        assert_eq!(h.habits.len(), 5);
        assert_eq!(h.habits[0].text, INITIAL[0]);
    }
    #[test]
    fn saves_both_checked_and_unchecked_states() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("habits.json");
        Habits::update(
            &path,
            Edit::Check {
                id: 1,
                checked: true,
            },
            TODAY,
        )
        .unwrap();
        assert!(Habits::load_for_date(&path, TODAY).unwrap().habits[0].checked);
        Habits::update(
            &path,
            Edit::Check {
                id: 1,
                checked: false,
            },
            TODAY,
        )
        .unwrap();
        assert!(!Habits::load_for_date(&path, TODAY).unwrap().habits[0].checked);
    }
    #[test]
    fn completed_habit_requires_confirmation_to_delete() {
        let mut h = Habits::initial(TODAY);
        h.edit(Edit::Check {
            id: 1,
            checked: true,
        })
        .unwrap();
        assert!(h
            .edit(Edit::Delete {
                id: 1,
                confirmed: false
            })
            .is_err());
        assert_eq!(h.habits.len(), 5);
        h.edit(Edit::Delete {
            id: 1,
            confirmed: true,
        })
        .unwrap();
        assert_eq!(h.habits.len(), 4);
    }
    #[test]
    fn closed_across_midnight_resets_on_reload_and_preserves_list() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("habits.json");
        Habits::update(
            &path,
            Edit::Rename {
                id: 1,
                text: "Custom chess goal".into(),
            },
            TODAY,
        )
        .unwrap();
        Habits::update(&path, Edit::Move { id: 1, to: 3 }, TODAY).unwrap();
        let old = Habits::update(
            &path,
            Edit::Check {
                id: 1,
                checked: true,
            },
            TODAY,
        )
        .unwrap();
        // No timer or process is running between these separate loads.
        let next = Habits::load_for_date(&path, "2026-11-12").unwrap();
        assert_eq!(next.date, "2026-11-12");
        assert!(next.habits.iter().all(|h| !h.checked));
        assert_eq!(
            old.habits
                .iter()
                .map(|h| (&h.text, h.id, h.order))
                .collect::<Vec<_>>(),
            next.habits
                .iter()
                .map(|h| (&h.text, h.id, h.order))
                .collect::<Vec<_>>()
        );
        assert!(Habits::load_for_date(&path, "2026-11-12")
            .unwrap()
            .habits
            .iter()
            .all(|h| !h.checked));
    }
    #[test]
    fn same_date_retains_completion_but_backward_clock_date_resets() {
        let mut h = Habits::initial(TODAY);
        h.habits[0].checked = true;
        assert!(!h.reset_for(TODAY));
        assert!(h.habits[0].checked);
        assert!(h.reset_for("2026-11-07"));
        assert!(!h.habits[0].checked);
    }
    #[test]
    fn malformed_file_is_not_overwritten_by_reset_or_edit() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("habits.json");
        std::fs::write(&path, b"not json").unwrap();
        assert!(Habits::load_for_date(&path, TODAY).is_err());
        assert!(Habits::update(
            &path,
            Edit::Add {
                text: "Walk".into()
            },
            TODAY
        )
        .is_err());
        assert_eq!(std::fs::read(&path).unwrap(), b"not json");
    }
    #[test]
    fn added_identifiers_and_order_survive_restart_without_reuse() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("habits.json");
        let added = Habits::update(
            &path,
            Edit::Add {
                text: "Walk".into(),
            },
            TODAY,
        )
        .unwrap();
        let id = added.habits.last().unwrap().id;
        Habits::update(&path, Edit::Move { id, to: 0 }, TODAY).unwrap();
        assert_eq!(
            Habits::load_for_date(&path, TODAY).unwrap().habits[0].id,
            id
        );
        Habits::update(
            &path,
            Edit::Delete {
                id,
                confirmed: false,
            },
            TODAY,
        )
        .unwrap();
        let next = Habits::update(&path, Edit::Add { text: "New".into() }, TODAY).unwrap();
        assert!(next.habits.last().unwrap().id > id);
        assert_eq!(next.habits[0].id, 1);
    }
    #[test]
    fn duplicate_identifiers_are_rejected() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("habits.json");
        let mut state = Habits::initial(TODAY);
        state.habits[1].id = state.habits[0].id;
        storage::write(&path, &state).unwrap();
        assert!(Habits::load_for_date(&path, TODAY).is_err());
    }
}
