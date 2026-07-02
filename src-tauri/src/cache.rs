use parking_lot::Mutex;
use redb::{Database, Error, ReadableDatabase, TableDefinition};
use std::collections::HashMap;
use std::fs::File;
use std::io::{self, BufReader, Read};
use std::path::Path;
use std::time::UNIX_EPOCH;

const CACHE_FILE_NAME: &str = "cache";
const NORMALIZATION_TABLE: TableDefinition<&str, f32> = TableDefinition::new("normalization");

pub struct CacheDb {
    db: Database,
    normalization_memory: Mutex<HashMap<String, f32>>,
}

impl CacheDb {
    pub fn open(path: &Path) -> Result<Self, Error> {
        let db = Database::create(path.join(CACHE_FILE_NAME))?;
        Ok(Self {
            db,
            normalization_memory: Mutex::new(HashMap::new()),
        })
    }

    pub fn clear_all_cache(&self) -> Result<(), Error> {
        let txn = self.db.begin_write()?;
        txn.delete_table(NORMALIZATION_TABLE)?;
        txn.commit()?;
        self.normalization_memory.lock().clear();
        Ok(())
    }

    /// Get optional cached normalization gain for a file by its hash.
    pub fn get_normalization_cache(&self, hash: &str) -> Result<Option<f32>, Error> {
        // Check memory cache first
        if let Some(&gain) = self.normalization_memory.lock().get(hash) {
            return Ok(Some(gain));
        }

        // Check database cache
        let txn = self.db.begin_read()?;
        match txn.open_table(NORMALIZATION_TABLE) {
            Ok(table) => {
                let gain = table.get(hash)?.map(|v| v.value());

                // Add to memory for faster lookup time
                if let Some(g) = gain {
                    self.normalization_memory.lock().insert(hash.to_string(), g);
                }
                Ok(gain)
            }
            Err(redb::TableError::TableDoesNotExist(_)) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Cache the normalization gain for a file by its hash.
    pub fn set_normalization_cache(&self, hash: &str, gain: f32) -> Result<(), Error> {
        self.normalization_memory
            .lock()
            .insert(hash.to_string(), gain);
        let txn = self.db.begin_write()?;
        txn.open_table(NORMALIZATION_TABLE)?.insert(hash, gain)?;
        txn.commit()?;
        Ok(())
    }

    /// Get a hash of a file from the path provided by its contents.
    #[allow(unused)]
    pub fn hash_file(&self, path: &str) -> io::Result<String> {
        let file = File::open(path)?;
        let mut reader = BufReader::new(file);
        let mut hasher = blake3::Hasher::new();
        let mut buf = [0u8; 65536];
        loop {
            let n = reader.read(&mut buf)?;
            if n == 0 {
                break;
            }
            hasher.update(&buf[..n]);
        }
        Ok(hasher.finalize().to_hex().to_string())
    }

    /// Get a cache key for a file based on its path and metadata.
    pub fn get_file_key(&self, path: &str) -> io::Result<String> {
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
