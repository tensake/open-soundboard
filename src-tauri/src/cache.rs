use parking_lot::Mutex;
use redb::{Database, Error, ReadableDatabase, TableDefinition};
use std::collections::HashMap;
use std::path::Path;
use std::time::UNIX_EPOCH;

const CACHE_FILE_NAME: &str = "cache";
const NORMALIZATION_TABLE: TableDefinition<&str, f32> = TableDefinition::new("normalization");
const DURATION_TABLE: TableDefinition<&str, u64> = TableDefinition::new("duration");

/// Sets a value in the cache to the specified database and memory.
macro_rules! set_cache {
    ($this:expr, $memory:expr, $table:expr, $hash:expr, $value:expr) => {{
        let value = $value;

        let txn = $this.db.begin_write()?;
        txn.open_table($table)?.insert($hash, value)?;
        txn.commit()?;

        $memory.lock().insert($hash.to_owned(), value);

        Ok(())
    }};
}

/// Gets a value from the cache.
macro_rules! get_cache {
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

    /// Get a cache key for a file based on its path and metadata.
    pub fn get_file_key(&self, path: &str) -> std::io::Result<String> {
        let meta = std::fs::metadata(path)?;
        let modified = meta
            .modified()?
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let size = meta.len();
        Ok(format!("{path}|{size}|{modified}"))
    }
}
