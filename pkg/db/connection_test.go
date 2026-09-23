package db

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestConnectionAndSchema(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "litelens-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	dbPath := filepath.Join(tempDir, "test.db")

	// Open read-write connection
	mgr, err := Open(dbPath, false)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	defer mgr.Close()

	ctx := context.Background()

	// Create test tables and indexes
	ddl := `
	CREATE TABLE users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		email TEXT UNIQUE,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE orders (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		total REAL NOT NULL,
		status TEXT DEFAULT 'pending',
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE INDEX idx_orders_user ON orders(user_id);
	CREATE INDEX idx_orders_status ON orders(status);

	CREATE VIEW active_users AS 
		SELECT id, name, email FROM users;

	CREATE TRIGGER trg_user_created AFTER INSERT ON users
	BEGIN
		UPDATE users SET name = trim(new.name) WHERE id = new.id;
	END;
	`

	_, err = mgr.db.ExecContext(ctx, ddl)
	if err != nil {
		t.Fatalf("failed to execute DDL: %v", err)
	}

	// Insert test data
	_, err = mgr.ExecuteStatement(ctx, "INSERT INTO users (name, email) VALUES (?, ?)", "Alice", "alice@example.com")
	if err != nil {
		t.Fatalf("insert failed: %v", err)
	}
	_, err = mgr.ExecuteStatement(ctx, "INSERT INTO users (name, email) VALUES (?, ?)", "Bob", "bob@example.com")
	if err != nil {
		t.Fatalf("insert failed: %v", err)
	}

	// Query data
	res, err := mgr.ExecuteQuery(ctx, "SELECT id, name, email FROM users ORDER BY id ASC")
	if err != nil {
		t.Fatalf("query failed: %v", err)
	}
	if len(res.Rows) != 2 {
		t.Fatalf("expected 2 rows, got %d", len(res.Rows))
	}
	if res.Rows[0]["name"] != "Alice" {
		t.Errorf("expected Alice, got %v", res.Rows[0]["name"])
	}

	// Introspect Database
	meta, err := mgr.IntrospectDatabase(ctx)
	if err != nil {
		t.Fatalf("introspect database failed: %v", err)
	}

	if len(meta.Tables) != 2 {
		t.Errorf("expected 2 tables, got %d", len(meta.Tables))
	}
	if len(meta.Views) != 1 {
		t.Errorf("expected 1 view, got %d", len(meta.Views))
	}

	// Verify table details
	var usersTable, ordersTable *TableInfo
	for i := range meta.Tables {
		if meta.Tables[i].Name == "users" {
			usersTable = &meta.Tables[i]
		}
		if meta.Tables[i].Name == "orders" {
			ordersTable = &meta.Tables[i]
		}
	}

	if usersTable == nil {
		t.Fatal("users table not found in metadata")
	}
	if usersTable.RowCount != 2 {
		t.Errorf("expected row count 2, got %d", usersTable.RowCount)
	}
	if len(usersTable.Columns) != 4 {
		t.Errorf("expected 4 columns in users table, got %d", len(usersTable.Columns))
	}
	if len(usersTable.Triggers) != 1 {
		t.Errorf("expected 1 trigger on users, got %d", len(usersTable.Triggers))
	}

	if ordersTable == nil {
		t.Fatal("orders table not found in metadata")
	}
	if len(ordersTable.ForeignKeys) != 1 {
		t.Errorf("expected 1 foreign key on orders, got %d", len(ordersTable.ForeignKeys))
	}
	if ordersTable.ForeignKeys[0].Table != "users" {
		t.Errorf("expected fk to reference users, got %s", ordersTable.ForeignKeys[0].Table)
	}
	if len(ordersTable.Indexes) < 2 {
		t.Errorf("expected at least 2 indexes on orders, got %d", len(ordersTable.Indexes))
	}

	// WAL Diagnostics & Checkpoint
	walDiag, err := mgr.InspectWal()
	if err != nil {
		t.Fatalf("inspect WAL failed: %v", err)
	}
	if !walDiag.WalExists {
		t.Log("Note: WAL file does not exist yet (normal if uncommitted frames were flushed)")
	}

	chkRes, err := mgr.ExecuteCheckpoint(ctx, "PASSIVE")
	if err != nil {
		t.Fatalf("checkpoint failed: %v", err)
	}
	if chkRes.Mode != "PASSIVE" {
		t.Errorf("expected mode PASSIVE, got %s", chkRes.Mode)
	}
}

func TestReadOnlyMode(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "litelens-ro-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	dbPath := filepath.Join(tempDir, "ro_test.db")

	// Create DB first
	mgr, err := Open(dbPath, false)
	if err != nil {
		t.Fatalf("failed to open: %v", err)
	}
	ctx := context.Background()
	_, _ = mgr.db.ExecContext(ctx, "CREATE TABLE items (id INTEGER PRIMARY KEY, title TEXT)")
	_, _ = mgr.db.ExecContext(ctx, "INSERT INTO items (title) VALUES ('Book')")
	mgr.Close()

	// Reopen in read-only mode
	roMgr, err := Open(dbPath, true)
	if err != nil {
		t.Fatalf("failed to open in read-only mode: %v", err)
	}
	defer roMgr.Close()

	if !roMgr.IsReadOnly() {
		t.Error("expected IsReadOnly to be true")
	}

	// Read should succeed
	res, err := roMgr.ExecuteQuery(ctx, "SELECT title FROM items")
	if err != nil {
		t.Fatalf("read query failed: %v", err)
	}
	if len(res.Rows) != 1 {
		t.Errorf("expected 1 row, got %d", len(res.Rows))
	}

	// Write should be rejected
	_, err = roMgr.ExecuteStatement(ctx, "INSERT INTO items (title) VALUES ('Pen')")
	if err == nil {
		t.Error("expected write statement to fail in read-only mode, but succeeded")
	}
}
