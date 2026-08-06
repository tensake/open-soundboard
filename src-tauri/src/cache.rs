use parking_lot::Mutex;
use redb::{Database, Error, ReadableDatabase, ReadableTable, TableDefinition};
use std::collections::HashMap;
use std::path::Path;
use std::time::UNIX_EPOCH;

const CACHE_FILE_NAME: &str = "cache";
const NORMALIZATION_TABLE: TableDefinition<&str, f32> = TableDefinition::new("normalization");
const DURATION_TABLE: TableDefinition<&str, u64> = TableDefinition::new("duration");
const HISTORY_TABLE: TableDefinition<u64, &str> = TableDefinition::new("history");

/// Sets a value in the cache to the specified database and memory.
macro_rules! set_cache {
    // Write to DB and memory
    ($this:expr, $memory:expr, $table:expr, $key:expr, $value:expr) => {{
        let value = $value;

        let txn = $this.db.begin_write()?;
        txn.open_table($table)?.insert($key, value)?;
        txn.commit()?;

        $memory.lock().insert($key.to_owned(), value);

        Ok(())
    }};

    // Write to DB only
    ($this:expr, $table:expr, $key:expr, $value:expr) => {{
        let txn = $this.db.begin_write()?;
        txn.open_table($table)?.insert($key, $value)?;
        txn.commit()?;

        Ok(())
    }};
}

/// Gets a value from the cache.
macro_rules! get_cache {
    // For getting one value
    ($this:expr, $memory:expr, $table:expr, $hash:expr) => {{
        if let Some(&value) = $memory.lock().get($hash) {
            Ok(Some(value))
        } else {
            let txn = $this.db.begin_read()?;

            match txn.open_table($table) {
                Ok(table) => {
                    let value = table.get($hash)?.map(|v| v.value());

                    if let Some(value) = value {
                        $memory.lock().insert($hash.to_owned(), value);
                    }

                    Ok(value)
                }
                Err(redb::TableError::TableDoesNotExist(_)) => Ok(None),
                Err(e) => Err(e.into()),
            }
        }
    }};

    // For getting latest multiple values
    ($this:expr, $table:expr, $count:expr) => {{
        let txn = $this.db.begin_read()?;

        // Reverse iterate the table to get latest values
        match txn.open_table($table) {
            Ok(table) => table
                .iter()?
                .rev()
                .take($count)
                .map(|entry| {
                    let (_, value) = entry?;
                    Ok(value.value().to_owned())
                })
                .collect::<Result<Vec<_>, Error>>(),

            Err(redb::TableError::TableDoesNotExist(_)) => Ok(Vec::new()),
            Err(e) => Err(e.into()),
        }
    }};
}

pub struct CacheDb {
    db: Database,
    normalization: Mutex<HashMap<String, f32>>,
    duration: Mutex<HashMap<String, u64>>,
}

impl CacheDb {
    pub fn open(path: &Path) -> Result<Self, Error> {
        let db = Database::create(path.join(CACHE_FILE_NAME))?;
        Ok(Self {
            db,
            normalization: Mutex::new(HashMap::new()),
            duration: Mutex::new(HashMap::new()),
        })
    }

    pub fn clear_all_cache(&self) -> Result<(), Error> {
        let txn = self.db.begin_write()?;
        txn.delete_table(NORMALIZATION_TABLE)?;
        txn.delete_table(DURATION_TABLE)?;
        txn.delete_table(HISTORY_TABLE)?;
        txn.commit()?;
        self.normalization.lock().clear();
        self.duration.lock().clear();
        Ok(())
    }

    pub fn get_normalization(&self, hash: &str) -> Result<Option<f32>, Error> {
        get_cache!(self, self.normalization, NORMALIZATION_TABLE, hash)
    }

    pub fn get_duration(&self, hash: &str) -> Result<Option<u64>, Error> {
        get_cache!(self, self.duration, DURATION_TABLE, hash)
    }

    pub fn set_normalization(&self, hash: &str, gain: f32) -> Result<(), Error> {
        set_cache!(self, self.normalization, NORMALIZATION_TABLE, hash, gain)
    }

    pub fn set_duration(&self, hash: &str, duration: u64) -> Result<(), Error> {
        set_cache!(self, self.duration, DURATION_TABLE, hash, duration)
    }

    pub fn get_sounds_history(&self) -> Result<Vec<String>, Error> {
        get_cache!(self, HISTORY_TABLE, 20)
    }

    pub fn record_sound(&self, timestamp: u64, path: &str) -> Result<(), Error> {
        set_cache!(self, HISTORY_TABLE, timestamp, path)
    }
}

/// Get a cache key for a file based on its path and metadata.
pub fn get_file_key(path: &str) -> std::io::Result<String> {
    let meta = std::fs::metadata(path)?;
    let modified = meta
        .modified()?
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let size = meta.len();
    Ok(format!("{path}|{size}|{modified}"))
}
