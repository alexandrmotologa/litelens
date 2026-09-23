# SQLite WAL Concurrency and Checkpointing

SQLite uses Write-Ahead Logging (WAL) to provide concurrent reads while a write transaction is in progress. However, long-running read transactions can block WAL checkpoints, leading to unbounded log growth and eventual `SQLITE_BUSY` errors.

## WAL Mechanics

When WAL mode is active (`PRAGMA journal_mode = WAL;`), SQLite writes modifications to an auxiliary file named `<database>.db-wal` instead of writing directly to the database file. A companion file, `<database>.db-shm`, contains shared-memory index structures that allow readers to find the latest version of any database page in the log.

A WAL file begins with a 32-byte header:
* Bytes 0..3: Magic number (0x377f0682 for little-endian or 0x377f0683 for big-endian).
* Bytes 4..7: File format version (3007000).
* Bytes 8..11: Database page size.
* Bytes 12..15: Checkpoint sequence number.
* Bytes 16..23: Salt values (used to validate frame checksums).
* Bytes 24..31: Cumulative checksum over the header.

Following the header, the file contains sequential frames. Each frame has a 24-byte header containing the target database page number, the database size in pages after this frame commits, salt values, and checksums.

## Checkpoint Starvation

Checkpointing copies committed pages from the `-wal` file back into the main `.db` file. Checkpointing can only proceed up to the oldest active read transaction. If a read transaction remains open, the checkpoint cannot overwrite or truncate subsequent frames because the reader still needs the older page versions.

This causes:
1. Continuous growth of the `-wal` file.
2. Slower read operations because readers must search more index entries in `-shm`.
3. Eventual write lock starvation when the WAL reaches configured limits.

## Checkpoint Modes

LiteLens allows invoking all four SQLite checkpoint operations:
* `PASSIVE`: Checkpoints as many frames as possible without waiting for readers or writers to finish. Never blocks.
* `FULL`: Waits for active writers to finish, checkpoints all committed frames, and blocks new writes until complete.
* `RESTART`: Similar to FULL, but additionally waits until all readers exit so that subsequent writes restart from the beginning of the WAL.
* `TRUNCATE`: Like RESTART, but truncates the `-wal` file to zero bytes upon completion.
