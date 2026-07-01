use redb::{Database, Error, ReadableDatabase, TableDefinition};
use std::fs::File;
use std::io;
use std::io::{BufReader, Read};
use std::path::Path;

const CACHE_FILE_NAME: &str = "cache";
const NORMALIZATION_TABLE: TableDefinition<&str, f32> = TableDefinition::new("normalization");

pub struct CacheDb {
    db: Database,
}

impl CacheDb {
    pub fn open(path: &Path) -> Result<Self, Error> {
        let db = Database::create(path.join(CACHE_FILE_NAME))?;
        Ok(Self { db })
    }

    pub fn clear_all_cache(&self) -> Result<(), Error> {
        let txn = self.db.begin_write()?;
        txn.delete_table(NORMALIZATION_TABLE)?;
        txn.commit()?;
        Ok(())
    }

    /// Get optional cached normalization gain for a file by its hash.
    pub fn get_normalization_cache(&self, hash: &str) -> Result<Option<f32>, Error> {
        let txn = self.db.begin_read()?;
        match txn.open_table(NORMALIZATION_TABLE) {
            Ok(table) => Ok(table.get(hash)?.map(|v| v.value())),
            Err(redb::TableError::TableDoesNotExist(_)) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Cache the normalization gain for a file by its hash.
    pub fn set_normalization_cache(&self, hash: &str, gain: f32) -> Result<(), Error> {
        let txn = self.db.begin_write()?;
        txn.open_table(NORMALIZATION_TABLE)?.insert(hash, gain)?;
        txn.commit()?;
        Ok(())
    }

    /// Get a hash of a file from the path provided.
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
}
