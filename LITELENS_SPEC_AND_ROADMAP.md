# Engineering Specification & Implementation Blueprint: LiteLens
> The Next-Gen SQLite 3.45+ Observability Studio, WAL Concurrency Diagnostics, Visual Query Plan & Vector Workbench (Reimagining DB Browser for SQLite)

---

## 1. Executive Summary & Market Opportunity

### 1.1 The Market Stagnation
**DB Browser for SQLite (`sqlitebrowser`)** has accumulated over 23,000 GitHub stars and remains the default tool for SQLite inspection. However, it is fundamentally frozen in 2005-era Qt/C++ design:
* **Clunky Legacy Interface:** Ancient table grids, unresponsive layout on high-DPI/Retina screens, and frequent crashes on databases larger than 500MB.
* **Ignorance of Modern SQLite Innovations:** Modern SQLite (3.40 - 3.45+) has introduced revolutionary features—`jsonb` binary JSON storage, vector embeddings via `sqlite-vec`, generated virtual columns, and strict typing mode (`STRICT`). DB Browser has zero native support for these capabilities.
* **No Concurrency Diagnostics:** Developers building web backends (with PocketBase, Litestream, Turso, Cloudflare D1) frequently run into cryptic `SQLITE_BUSY: database is locked` errors. Existing tools cannot inspect the Write-Ahead Log (WAL), checkpoint progression, or blocking lock holders.

### 1.2 The Solution: LiteLens
**LiteLens** is a single-binary, local-first management studio and diagnostic engine built specifically for modern **SQLite 3.45+**.

* **WAL Concurrency Diagnostics:** Visualizes uncommitted WAL frames, checkpoint delays, lock contention, and active read transactions blocking writers.
* **Visual `EXPLAIN QUERY PLAN` Graph:** Transforms SQLite's cryptic text query plans into interactive node graphs, visually highlighting table scans (red flags), index b-tree searches, and temporary B-tree sorting.
* **First-Class Vector & JSONB Inspector:** Native query builder and visualizer for high-dimensional vector embeddings (`sqlite-vec`) and structured binary JSON documents.
* **Schema Migration & Diff Engine:** Compares two `.db` or `.sqlite` files, automatically generating clean SQL DDL migrations with data integrity checks.
* **Single-Binary Zero-CGO Distribution:** Built in **Go** using pure-Go SQLite (`modernc.org/sqlite`) combined with an embedded Vite + React 19 UI via `go:embed`. Cross-compiles natively for Windows, macOS, and Linux without external C runtimes.

---

## 2. Core Architecture & Tech Stack

```
┌────────────────────────────────────────────────────────────────────────┐
│                          LiteLens Architecture                         │
└────────────────────────────────────────────────────────────────────────┘

[ Web Browser / Local Desktop Client ] (http://localhost:52000)
              │
              ▼  (HTTP REST / WebSocket / SSE)
[ LiteLens Single Binary ] (Go 1.23+ Engine)
  ├── Static Asset Server: go:embed (Vite + React 19 + Monaco Editor)
  ├── SQLite Engine & Diagnostic Layer
  │     ├── Pure-Go SQLite Driver (modernc.org/sqlite - zero CGO)
  │     ├── PRAGMA Manager (wal_checkpoint, journal_mode, synchronous)
  │     └── WAL Frame Analyzer (Inspects -wal and -shm files directly)
  ├── Query Optimizer & Visualizer
  │     ├── EXPLAIN QUERY PLAN Parser & Graph Synthesizer
  │     ├── Index Advisor (Identifies missing indexes on slow queries)
  │     └── Vector Search Engine (sqlite-vec distance queries)
  └── Schema & Data Workbench
        ├── Table Grid with Virtualized Infinite Scrolling
        ├── JSONB & BLOB Media Viewer (Hex, Image, JSON tree)
        └── Database Diff & Schema Migration Generator
              │
              ▼ (Direct File I/O)
[ Target SQLite Database File (.db / .sqlite / .sqlite3 / .wal) ]
```

### 2.1 Backend Technology
* **Language:** Go 1.23+
* **SQLite Driver:** `modernc.org/sqlite` (Pure Go port of SQLite 3.45+; 100% CGO-free, enables effortless cross-compilation across Windows, Linux, and macOS).
* **Router & Streaming:** `github.com/go-chi/chi/v5` + SSE for live WAL and query telemetry.
* **File Watcher:** `github.com/fsnotify/fsnotify` to detect external writes and WAL modifications in real time.

### 2.2 Frontend Technology
* **Core:** Vite + React 19 + TypeScript.
* **Data Grid:** TanStack Virtual Table for silky smooth rendering of 500,000+ rows.
* **Query Plan Graph:** React Flow / SVG DAG layout for visualizing query execution nodes.
* **Editor:** Monaco Editor with SQLite dialect autocompletion and SQL formatting.

---

## 3. Key Feature Specifications

### 3.1 WAL Concurrency & Lock Diagnostics
* **Real-Time WAL Inspector:** Tracks size and frame distribution in `database.db-wal` and `database.db-shm`.
* **Lock Contention Heatmap:** Detects long-running read transactions that prevent the checkpoint from truncating the WAL, leading to write lock starvation.
* **1-Click Checkpoint:** Safe UI execution of `PRAGMA wal_checkpoint(PASSIVE / FULL / RESTART / TRUNCATE)`.

### 3.2 Visual `EXPLAIN QUERY PLAN` & Index Advisor
* Paste any SQL query; LiteLens executes `EXPLAIN QUERY PLAN` and builds an interactive DAG:
  * **Green Nodes:** Index Lookups (`SEARCH TABLE ... USING INDEX`).
  * **Yellow Nodes:** Partial Index Scans or Temporary B-Trees (`USE TEMP B-TREE FOR ORDER BY`).
  * **Red Alert Nodes:** Full Table Scans (`SCAN TABLE ...`).
* **Index Advisor:** Automatically suggests optimal composite indexes (`CREATE INDEX idx_... ON ...`) to eliminate red table scans.

### 3.3 Vector Search & Modern Data Types
* **`sqlite-vec` & Vector Explorer:** Inspect vector embeddings stored in virtual vector tables or BLOB columns. Test nearest-neighbor vector similarity (`vec_distance_cosine()`, `vec_distance_l2()`).
* **`jsonb` Viewer:** Decode SQLite 3.45 binary JSON into editable syntax-highlighted JSON trees with JSONPath filtering.
* **Smart BLOB Inspector:** Auto-detects embedded image files (PNG, JPG, WebP), audio clips, and raw binary hex.

### 3.4 Database Diff & Migration Generator
* Load two database versions (e.g. `v1.db` vs `v2.db`).
* LiteLens calculates structural AST diffs (added/modified/dropped tables, columns, indexes, triggers) and generates safe DDL migration scripts with transaction rollback safety.

---

## 4. CLI Command-Line Specification

```bash
# Launch LiteLens studio opening target SQLite database
litelens app.db

# Launch web server on custom port without auto-opening browser
litelens -p 8080 --no-browser production.db

# Launch in strict read-only mode (prevents writes/schema changes)
litelens --read-only secure.db

# Headless CLI Query Plan Analysis & Index Advice
litelens explain my.db "SELECT * FROM orders WHERE status = 'pending' ORDER BY created_at"

# Compare two databases and export migration DDL
litelens diff old_schema.db new_schema.db --output migration.sql
```

---

## 5. Repository File Structure

```
litelens/
├── go.mod
├── go.sum
├── main.go                       # Application entrypoint & CLI dispatcher
├── Makefile                      # Build scripts (UI build + Go embed)
├── README.md
├── LICENSE
├── cmd/
│   ├── root.go                   # Cobra CLI root
│   ├── serve.go                  # Web studio runner
│   ├── explain.go                # Headless query plan analyzer
│   └── diff.go                   # Database migration diff command
├── pkg/
│   ├── db/                       # Pure-Go SQLite management
│   │   ├── connection.go         # Connection pool & PRAGMA configuration
│   │   ├── schema.go             # Table, column, index, trigger metadata
│   │   └── wal.go                # WAL file parser & checkpoint runner
│   ├── analyzer/                 # Query Plan & Index Advisor
│   │   ├── plan_parser.go        # EXPLAIN QUERY PLAN string to AST DAG
│   │   ├── advisor.go            # Missing index rule engine
│   │   └── diff_engine.go        # Database schema comparison engine
│   └── types/                    # Modern data codecs
│       ├── jsonb.go              # SQLite 3.45 JSONB decoder
│       └── vector.go             # Vector embedding distance calculations
├── server/
│   ├── router.go                 # Chi HTTP router setup
│   ├── handlers/
│   │   ├── data_handler.go       # Paginated table records & editing
│   │   ├── plan_handler.go       # Query execution & plan graph API
│   │   ├── wal_handler.go        # WAL status & live SSE watcher
│   │   └── diff_handler.go       # Schema diffing API
│   └── static.go                 # go:embed dist/* static file server
├── ui/                           # Modern Frontend Application (Vite + React 19)
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── TableSidebar/     # Schema tree (tables, views, indexes)
│   │   │   ├── VirtualGrid/      # 500k-row virtualized table data grid
│   │   │   ├── QueryEditor/      # Monaco SQL editor & execution stats
│   │   │   ├── VisualPlan/       # Interactive React Flow execution graph
│   │   │   ├── WalDashboard/     # WAL frames, checkpoint delays, locks
│   │   │   └── DiffModal/        # Visual schema comparison & DDL generator
│   │   └── styles/globals.css
└── tests/
    ├── wal_test.go               # WAL tracking & checkpoint tests
    ├── plan_test.go              # Query plan parser tests
    └── diff_test.go              # Schema migration diff tests
```

---

## 6. Implementation Roadmap (Phases 1 - 6)

* **Phase 1: Pure-Go SQLite Driver & Schema Introspection**
  * Set up `modernc.org/sqlite`, connection pools, and read-only mode safety guards.
  * Extract table schemas, foreign keys, indexes, and row counts via `sqlite_master`.
* **Phase 2: High-Performance Data Grid & CRUD**
  * Build paginated, cursor-based table querying with sorting, filtering, and cell updates.
  * Implement frontend Virtual Table capable of scrolling millions of rows smoothly.
* **Phase 3: Visual Query Plan & Index Advisor**
  * Parse `EXPLAIN QUERY PLAN` output into structured DAG JSON.
  * Render visual flowchart nodes distinguishing table scans, index searches, and temp sorts.
  * Suggest index creation SQL commands for high-cost scans.
* **Phase 4: WAL Concurrency & Lock Diagnostic Dashboard**
  * Parse WAL file headers, track total frames and checkpoint status.
  * Stream live file change events via SSE to update the concurrency dashboard.
* **Phase 5: Modern Types (JSONB, BLOBs, Vectors) & Database Diff**
  * Support SQLite 3.45 JSONB parsing and image BLOB preview.
  * Build database comparison engine that produces clean migration DDL.
* **Phase 6: Single-Binary Packaging & CI/CD**
  * Embed frontend into Go binary via `go:embed`, generate multi-platform builds, verify zero-CGO compilation, and produce demo assets.
