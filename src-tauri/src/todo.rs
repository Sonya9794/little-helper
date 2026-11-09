//! Independent local to-do data. Completion never participates in habit resets.
use crate::storage::{self, Result};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, path::Path};

#[derive(Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: u64,
    pub checked: bool,
    pub task: String,
    pub deadline: Option<String>,
    pub time_needed_minutes: Option<u32>,
    pub color: String,
}
#[derive(Clone, Serialize, Deserialize)]
pub struct Store {
    version: u8,
    next_id: u64,
    pub tasks: Vec<Task>,
}
impl Default for Store {
    fn default() -> Self {
        Self {
            version: 1,
            next_id: 1,
            tasks: vec![],
        }
    }
}
#[derive(Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Edit {
    Add { task: String },
    Rename { id: u64, task: String },
    Check { id: u64, checked: bool },
    Deadline { id: u64, deadline: Option<String> },
    Duration { id: u64, minutes: Option<u32> },
    Color { id: u64, color: String },
    Delete { id: u64 },
}
fn name(value: &str) -> Result<String> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > 2000 {
        return Err("Task text must contain 1–2000 characters.".into());
    }
    Ok(value.to_string())
}
fn deadline(value: &Option<String>) -> Result<()> {
    if let Some(value) = value {
        if value.len() != 16
            || chrono::NaiveDateTime::parse_from_str(value, "%Y-%m-%dT%H:%M").is_err()
        {
            return Err("Deadline must be a valid local date and time.".into());
        }
    }
    Ok(())
}
fn color(value: &str) -> Result<()> {
    if value.len() != 7
        || !value.starts_with('#')
        || !value.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)
    {
        return Err("Choose a valid six-digit row color.".into());
    }
    Ok(())
}
impl Store {
    pub fn load(path: &Path) -> Result<Self> {
        let store: Self = storage::read(path)?.unwrap_or_default();
        let validate = || -> Result<()> {
            if store.version != 1 || store.next_id == 0 {
                return Err("Unsupported to-do storage version or invalid identifier.".into());
            }
            let mut ids = HashSet::new();
            for task in &store.tasks {
                if task.id == 0 || task.id >= store.next_id || !ids.insert(task.id) {
                    return Err("Invalid or duplicate task identifier.".into());
                }
                name(&task.task)?;
                deadline(&task.deadline)?;
                color(&task.color)?;
            }
            Ok(())
        };
        validate().map_err(|error| {
            format!(
                "Invalid to-do data in {}: {error} The file was not changed.",
                path.display()
            )
        })?;
        Ok(store)
    }
    pub fn edit(path: &Path, edit: Edit) -> Result<Self> {
        let mut store = Self::load(path)?;
        if let Edit::Add { task } = edit {
            let task = name(&task)?;
            let id = store.next_id;
            store.next_id = id.checked_add(1).ok_or("Task identifiers exhausted")?;
            store.tasks.push(Task {
                id,
                task,
                checked: false,
                deadline: None,
                time_needed_minutes: None,
                color: "#fffdf5".into(),
            });
        } else {
            let id = match &edit {
                Edit::Rename { id, .. }
                | Edit::Check { id, .. }
                | Edit::Deadline { id, .. }
                | Edit::Duration { id, .. }
                | Edit::Color { id, .. }
                | Edit::Delete { id } => *id,
                Edit::Add { .. } => unreachable!(),
            };
            let task = store
                .tasks
                .iter_mut()
                .find(|task| task.id == id)
                .ok_or("Task not found")?;
            match edit {
                Edit::Rename { task: value, .. } => task.task = name(&value)?,
                Edit::Check { checked, .. } => task.checked = checked,
                Edit::Deadline {
                    deadline: value, ..
                } => {
                    deadline(&value)?;
                    task.deadline = value;
                }
                Edit::Duration { minutes, .. } => {
                    task.time_needed_minutes = minutes.filter(|minutes| *minutes > 0)
                }
                Edit::Color { color: value, .. } => {
                    color(&value)?;
                    task.color = value.to_ascii_lowercase();
                }
                Edit::Delete { .. } => store.tasks.retain(|task| task.id != id),
                Edit::Add { .. } => unreachable!(),
            }
        }
        storage::write(path, &store)?;
        Ok(store)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn first_use_is_empty_and_edits_keep_stable_identifiers() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("todo.json");
        assert!(Store::load(&path).unwrap().tasks.is_empty());
        let store = Store::edit(
            &path,
            Edit::Add {
                task: "  Read paper  ".into(),
            },
        )
        .unwrap();
        let id = store.tasks[0].id;
        Store::edit(
            &path,
            Edit::Rename {
                id,
                task: "Write notes".into(),
            },
        )
        .unwrap();
        Store::edit(&path, Edit::Check { id, checked: true }).unwrap();
        let store = Store::load(&path).unwrap();
        assert_eq!(store.tasks[0].id, id);
        assert!(store.tasks[0].checked);
        assert_eq!(store.tasks[0].task, "Write notes");
        Store::edit(&path, Edit::Check { id, checked: false }).unwrap();
        assert!(!Store::load(&path).unwrap().tasks[0].checked);
    }
    #[test]
    fn deadline_duration_and_row_color_persist_and_can_be_cleared() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("todo.json");
        let id = Store::edit(
            &path,
            Edit::Add {
                task: "Application".into(),
            },
        )
        .unwrap()
        .tasks[0]
            .id;
        Store::edit(
            &path,
            Edit::Deadline {
                id,
                deadline: Some("2026-11-15T15:30".into()),
            },
        )
        .unwrap();
        Store::edit(
            &path,
            Edit::Duration {
                id,
                minutes: Some(95),
            },
        )
        .unwrap();
        Store::edit(
            &path,
            Edit::Color {
                id,
                color: "#AABBCC".into(),
            },
        )
        .unwrap();
        let store = Store::load(&path).unwrap();
        assert_eq!(store.tasks[0].deadline.as_deref(), Some("2026-11-15T15:30"));
        assert_eq!(store.tasks[0].time_needed_minutes, Some(95));
        assert_eq!(store.tasks[0].color, "#aabbcc");
        Store::edit(&path, Edit::Deadline { id, deadline: None }).unwrap();
        Store::edit(
            &path,
            Edit::Duration {
                id,
                minutes: Some(0),
            },
        )
        .unwrap();
        let store = Store::load(&path).unwrap();
        assert!(store.tasks[0].deadline.is_none());
        assert!(store.tasks[0].time_needed_minutes.is_none());
    }
    #[test]
    fn deletion_does_not_reuse_identifiers_or_change_other_rows() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("todo.json");
        Store::edit(&path, Edit::Add { task: "A".into() }).unwrap();
        Store::edit(&path, Edit::Add { task: "B".into() }).unwrap();
        Store::edit(&path, Edit::Delete { id: 1 }).unwrap();
        let store = Store::edit(&path, Edit::Add { task: "C".into() }).unwrap();
        assert_eq!(
            store.tasks.iter().map(|task| task.id).collect::<Vec<_>>(),
            [2, 3]
        );
        assert_eq!(store.tasks[0].task, "B");
    }
    #[test]
    fn invalid_edits_leave_saved_bytes_unchanged() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("todo.json");
        Store::edit(&path, Edit::Add { task: "A".into() }).unwrap();
        let original = std::fs::read(&path).unwrap();
        for edit in [
            Edit::Rename {
                id: 1,
                task: " \n ".into(),
            },
            Edit::Deadline {
                id: 1,
                deadline: Some("2026-02-30T10:00".into()),
            },
            Edit::Color {
                id: 1,
                color: "red".into(),
            },
            Edit::Delete { id: 99 },
        ] {
            assert!(Store::edit(&path, edit).is_err());
            assert_eq!(std::fs::read(&path).unwrap(), original);
        }
    }
    #[test]
    fn malformed_or_unreadable_files_are_not_replaced() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("todo.json");
        std::fs::write(&path, "{broken").unwrap();
        assert!(Store::edit(&path, Edit::Add { task: "A".into() }).is_err());
        assert_eq!(std::fs::read_to_string(&path).unwrap(), "{broken");
        assert!(Store::load(dir.path()).is_err());
    }
    #[test]
    fn duplicate_ids_are_rejected_without_repairing_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("todo.json");
        let mut store = Store::edit(&path, Edit::Add { task: "A".into() }).unwrap();
        store.tasks.push(store.tasks[0].clone());
        storage::write(&path, &store).unwrap();
        let before = std::fs::read(&path).unwrap();
        assert!(Store::load(&path).is_err());
        assert_eq!(std::fs::read(&path).unwrap(), before);
    }
}
