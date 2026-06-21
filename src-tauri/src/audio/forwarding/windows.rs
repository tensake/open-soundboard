use std::sync::mpsc;
use std::sync::Arc;
use std::sync::atomic::AtomicU8;

pub fn list_sessions() -> Result<Vec<u32>, Box<dyn std::error::Error>> {
    Ok(vec![])
}

pub fn forwarding_loop(pid: u32, tx: mpsc::SyncSender<Vec<f32>>, state: Arc<AtomicU8>) -> Result<(), Box<dyn std::error::Error>> {
    // TODO: send data to tx

    Ok(())
}
