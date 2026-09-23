# LiteLens

LiteLens is a single-binary management studio and diagnostic engine for modern SQLite 3.45+. It focuses on areas that traditional database managers overlook: Write-Ahead Log concurrency diagnostics, visual query plan trees, missing index suggestions, vector embedding inspection, and schema diffing.

LiteLens runs locally as a standalone executable. It compiles with zero CGO dependencies via pure-Go SQLite (`modernc.org/sqlite`), embedding its React interface into the compiled Go binary.

![LiteLens Studio Demo](docs/images/litelens_demo.gif)

## Highlights

* **Database Doctor & Health Audit:** Comprehensive diagnostic health scores (0 to 100), PRAGMA integrity_check, quick_check, orphan foreign key detectors, freelist fragmentation metrics, and safe in-place VACUUM or VACUUM INTO execution.
* **Interactive ER Diagram:** Full visual graph of tables with cubic Bezier curves connecting foreign key relationships, 1:N cardinality indicators, pan/zoom controls, and table relation highlighting.
* **Diagnostic Recipes & Saved Queries:** Pre-built 1-click SQLite diagnostic routines for discovering unindexed foreign keys, storage geometry footprints, trigger catalogs, and local query persistence.
* **FTS5 Full-Text Search Studio:** Visual query builder with match operators (AND, OR, NOT, prefix search, phrase matching), BM25 relevance ranking scores, keyword snippet highlighting, and a virtual table creation wizard with automatic synchronization triggers.
* **WAL Index Shared Memory (-shm) Inspector:** Binary parser for the 136-byte WAL index header and the 5 concurrent reader lock marks (aReadMark[0..4]), actively identifying blocking reader frames holding back checkpoints.
* **Vector 2D PCA Scatter Plot:** Dimensionality reduction projecting high-dimensional float32 vector embeddings onto an interactive 2D SVG canvas for cluster inspection, distance measurements, and similarity analysis.
* **Import & Export Hub:** Streaming SQL dumps with transaction-wrapped DDL and DML, RFC 4180 CSV exports, newline-delimited JSONL, and drag-and-drop CSV/JSON dataset importing with automatic schema inference.
* **Visual Query Plan:** Converts text EXPLAIN QUERY PLAN output into a structured graph with color-coded alerts for table scans and temporary sorting trees.
* **Index Advisor:** Evaluates query plan scans and suggests targeted CREATE INDEX statements.
* **Modern SQLite Types:** Decodes SQLite 3.45 binary JSON (jsonb), previews vector embeddings with distance metrics, and inspects image BLOBs directly.
* **Schema Diff and Migration Generator:** Compares two database files and outputs transactional SQL migration scripts.
* **Zero-CGO Distribution:** Compiles to a single binary with no external C dependencies.

## Architecture

LiteLens pairs a Go backend engine with a React 19 web interface embedded via `go:embed`.

```
Browser Interface (http://localhost:52000)
       │
       ▼ (HTTP REST / Server-Sent Events)
LiteLens Binary (Go)
  ├── Static Server: embedded React 19 UI
  ├── Engine Layer: pure-Go SQLite driver (modernc.org/sqlite)
  ├── Concurrency Monitor: WAL & SHM binary parsers, fsnotify watcher
  ├── Doctor & Diagnostics: PRAGMA integrity audit, freelist analyzer
  ├── FTS5 Engine: virtual table detector, DDL and trigger generator
  ├── Transfer Hub: streaming SQL dump, CSV/JSONL import & export
  ├── Query Analyzer: EXPLAIN parser and Index Advisor
  └── Schema Engine: AST comparator and migration generator
       │
       ▼ (Direct File I/O)
Target SQLite Database (.db, .sqlite, .wal, .shm)
```

## Quick Start

### Installation

Download the precompiled binary for your operating system from GitHub Releases, or install with Go:

```bash
go install github.com/alexandrmotologa/litelens@latest
```

### Basic Usage

Open a target SQLite database in your browser:

```bash
litelens app.db
```

Launch on a custom port without opening a browser window:

```bash
litelens -p 8080 --no-browser production.db
```

Open in read-only mode to prevent any writes:

```bash
litelens --read-only secure.db
```

Run query plan analysis directly in the terminal:

```bash
litelens explain app.db "SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at"
```

Compare two database schemas and generate a migration script:

```bash
litelens diff v1.db v2.db --output migration.sql
```

## Development

### Prerequisites

* Go 1.23 or newer
* Node.js 20 or newer
* npm or pnpm

### Building from Source

1. Clone the repository:
   ```bash
   git clone https://github.com/alexandrmotologa/litelens.git
   cd litelens
   ```

2. Build the UI assets:
   ```bash
   cd ui
   npm install
   npm run build
   cd ..
   ```

3. Compile the Go binary:
   ```bash
   go build -o bin/litelens main.go
   ```

4. Run the development server with live reload:
   ```bash
   make dev
   ```

## License

MIT License. See [LICENSE](LICENSE) for details.
