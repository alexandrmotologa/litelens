package transfer

import (
	"bytes"
	"context"
	"database/sql"
	"strings"
	"testing"

	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T) *sql.DB {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed opening in-memory db: %v", err)
	}

	_, err = db.Exec(`
		CREATE TABLE items (
			id INTEGER PRIMARY KEY,
			title TEXT NOT NULL,
			price REAL,
			payload BLOB
		);
		INSERT INTO items (id, title, price, payload) VALUES
			(1, 'Item One', 19.99, X'01020304'),
			(2, 'Item Two', 42.50, NULL);
	`)
	if err != nil {
		t.Fatalf("failed seeding test data: %v", err)
	}
	return db
}

func TestGenerateSqlDump(t *testing.T) {
	ctx := context.Background()
	db := setupTestDB(t)
	defer db.Close()

	var buf bytes.Buffer
	err := GenerateSqlDump(ctx, db, &buf, []string{"items"})
	if err != nil {
		t.Fatalf("GenerateSqlDump failed: %v", err)
	}

	dump := buf.String()
	if !strings.Contains(dump, "CREATE TABLE items") {
		t.Errorf("dump missing CREATE TABLE: %s", dump)
	}
	if !strings.Contains(dump, "INSERT INTO \"items\"") {
		t.Errorf("dump missing INSERT: %s", dump)
	}
	if !strings.Contains(dump, "X'01020304'") {
		t.Errorf("dump missing hex blob: %s", dump)
	}
}

func TestExportAndImportCsv(t *testing.T) {
	ctx := context.Background()
	db := setupTestDB(t)
	defer db.Close()

	var buf bytes.Buffer
	if err := ExportCsv(ctx, db, "items", &buf); err != nil {
		t.Fatalf("ExportCsv failed: %v", err)
	}

	csvData := buf.String()
	if !strings.Contains(csvData, "title") || !strings.Contains(csvData, "Item One") {
		t.Errorf("unexpected csv output: %s", csvData)
	}

	// Now test importing into a new table
	res, err := ImportCsv(ctx, db, "imported_items", strings.NewReader(csvData), true)
	if err != nil {
		t.Fatalf("ImportCsv failed: %v", err)
	}

	if res.RowsImported != 2 {
		t.Errorf("expected 2 rows imported, got %d", res.RowsImported)
	}
	if !res.TableCreated {
		t.Errorf("expected TableCreated to be true")
	}

	var count int
	_ = db.QueryRowContext(ctx, "SELECT count(*) FROM imported_items;").Scan(&count)
	if count != 2 {
		t.Errorf("expected 2 records in imported_items, got %d", count)
	}
}

func TestImportJson(t *testing.T) {
	ctx := context.Background()
	db := setupTestDB(t)
	defer db.Close()

	jsonData := `[
		{"name": "Alpha", "score": 98.5},
		{"name": "Beta", "score": 87.2}
	]`

	res, err := ImportJson(ctx, db, "scores", strings.NewReader(jsonData), true)
	if err != nil {
		t.Fatalf("ImportJson failed: %v", err)
	}

	if res.RowsImported != 2 {
		t.Errorf("expected 2 rows imported, got %d", res.RowsImported)
	}
}
