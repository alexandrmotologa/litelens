# LiteLens Architecture

LiteLens is structured as a modular Go application paired with a modern React single-page frontend.

## Directory Layout

* `cmd/`: Cobra CLI commands (`root.go`, `serve.go`, `explain.go`, `diff.go`). Handles argument parsing, configuration flags, and process lifecycle.
* `pkg/db/`: Pure-Go SQLite connectivity and inspection layer.
  * `connection.go`: Connection pooling, PRAGMA configuration (`journal_mode=WAL`, `busy_timeout`), and read-only connection wrappers.
  * `schema.go`: Extracts table, view, column, index, trigger, and foreign key definitions.
  * `wal.go`: Direct binary parser for `-wal` and `-shm` files to read frame headers without locking SQLite.
* `pkg/analyzer/`: Query plan and schema analysis.
  * `plan_parser.go`: Transforms SQLite `EXPLAIN QUERY PLAN` text output into a structured Directed Acyclic Graph (DAG).
  * `advisor.go`: Evaluates query plans to suggest targeted composite or single-column indexes.
  * `diff_engine.go`: Compares two SQLite schemas and generates reversible SQL migration scripts.
  * `vdbe.go`: Bytecode parser for virtual database engine opcode traces.
* `pkg/types/`: Decoders for SQLite 3.45+ data representations.
  * `jsonb.go`: Decoder for binary JSON (`jsonb`) payloads.
  * `vector.go`: Distance functions (Cosine, L2, Dot Product) for float32 vector arrays.
  * `blob.go`: Binary data inspection and MIME type detection.
* `server/`: HTTP API server and static asset embedding.
  * `router.go`: Chi router setup with CORS, recovery, and logging.
  * `handlers/`: Handlers for schema inspection, data pagination, query execution, WAL telemetry, and diffing.
  * `static.go`: Embeds the compiled `ui/dist` bundle into the Go binary.
* `ui/`: Frontend client built with Vite, React 19, TypeScript, and Tailwind CSS.
  * `src/components/`: Reusable components including virtual table grids, Monaco query editor, visual query plan DAG, and WAL dashboard.

## Concurrency and Telemetry

LiteLens monitors the target database without interfering with active writers:
1. It parses the 32-byte WAL header directly from disk to inspect frame counts and salt values.
2. It uses `fsnotify` to track file modifications, streaming changes to the web client over Server-Sent Events (SSE).
3. Checkpoint operations (`PRAGMA wal_checkpoint`) run through dedicated connections with explicit timeouts to prevent locking active transactions.
