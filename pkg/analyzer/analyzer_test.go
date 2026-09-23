package analyzer

import (
	"context"
	"database/sql"
	"strings"
	"testing"

	"github.com/alexandrmotologa/litelens/pkg/db"
	_ "modernc.org/sqlite"
)

func TestPlanParserAndAdvisor(t *testing.T) {
	conn, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open memory sqlite: %v", err)
	}
	defer conn.Close()

	ctx := context.Background()

	// Setup schema
	ddl := `
	CREATE TABLE customers (
		id INTEGER PRIMARY KEY,
		name TEXT,
		country TEXT,
		score REAL
	);
	CREATE TABLE orders (
		id INTEGER PRIMARY KEY,
		customer_id INTEGER,
		amount REAL,
		status TEXT
	);
	`
	if _, err := conn.ExecContext(ctx, ddl); err != nil {
		t.Fatalf("failed to create tables: %v", err)
	}

	// Insert dummy rows
	for i := 1; i <= 10; i++ {
		_, _ = conn.ExecContext(ctx, "INSERT INTO customers VALUES (?, 'User', 'USA', 99.0)", i)
		_, _ = conn.ExecContext(ctx, "INSERT INTO orders VALUES (?, ?, 50.0, 'completed')", i, i)
	}

	// Query with full table scan
	query := "SELECT * FROM customers WHERE country = 'USA' ORDER BY score DESC"
	graph, err := ExplainQueryPlan(ctx, conn, query)
	if err != nil {
		t.Fatalf("explain query plan failed: %v", err)
	}

	if graph.TotalNodes == 0 {
		t.Fatalf("expected plan nodes, got 0")
	}
	if graph.FullTableScans == 0 {
		t.Errorf("expected at least 1 full table scan for unindexed query, got %d", graph.FullTableScans)
	}

	// Test Index Advisor
	tables := []db.TableInfo{
		{
			Name: "customers",
			Columns: []db.ColumnInfo{
				{Name: "id", Type: "INTEGER"},
				{Name: "country", Type: "TEXT"},
				{Name: "score", Type: "REAL"},
			},
		},
	}

	advisor := NewAdvisor()
	recs := advisor.AnalyzeQuery(query, graph, tables)
	if len(recs) == 0 {
		t.Fatalf("expected index recommendations, got 0")
	}

	foundCountry := false
	for _, rec := range recs {
		if rec.Table == "customers" {
			for _, col := range rec.Columns {
				if col == "country" {
					foundCountry = true
				}
			}
		}
	}
	if !foundCountry {
		t.Errorf("expected advisor to recommend index containing 'country', got: %+v", recs)
	}
}

func TestDiffEngine(t *testing.T) {
	oldSchema := &db.SchemaMetadata{
		DatabasePath: "v1.db",
		Tables: []db.TableInfo{
			{
				Name: "users",
				SQL:  "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)",
				Columns: []db.ColumnInfo{
					{Name: "id", Type: "INTEGER"},
					{Name: "name", Type: "TEXT"},
				},
			},
			{
				Name: "logs",
				SQL:  "CREATE TABLE logs (id INTEGER PRIMARY KEY, msg TEXT)",
			},
		},
	}

	newSchema := &db.SchemaMetadata{
		DatabasePath: "v2.db",
		Tables: []db.TableInfo{
			{
				Name: "users",
				SQL:  "CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT)",
				Columns: []db.ColumnInfo{
					{Name: "id", Type: "INTEGER"},
					{Name: "name", Type: "TEXT"},
					{Name: "email", Type: "TEXT"},
				},
				Indexes: []db.IndexInfo{
					{
						Name: "idx_users_email",
						SQL:  "CREATE UNIQUE INDEX idx_users_email ON users(email)",
					},
				},
			},
			{
				Name: "products",
				SQL:  "CREATE TABLE products (id INTEGER PRIMARY KEY, price REAL)",
			},
		},
	}

	report := CompareSchemas(oldSchema, newSchema)
	if report.TotalChanges == 0 {
		t.Fatalf("expected schema changes, got 0")
	}

	// Check that products was added
	foundAddProducts := false
	foundAddEmail := false
	foundDropLogs := false
	foundAddIdx := false

	for _, ch := range report.Changes {
		if ch.Type == ChangeAdd && ch.EntityName == "products" {
			foundAddProducts = true
		}
		if ch.Type == ChangeAdd && ch.EntityName == "email" && ch.TableName == "users" {
			foundAddEmail = true
		}
		if ch.Type == ChangeDrop && ch.EntityName == "logs" {
			foundDropLogs = true
		}
		if ch.Type == ChangeAdd && ch.EntityName == "idx_users_email" {
			foundAddIdx = true
		}
	}

	if !foundAddProducts {
		t.Error("expected products table add change")
	}
	if !foundAddEmail {
		t.Error("expected email column add change")
	}
	if !foundDropLogs {
		t.Error("expected logs table drop change")
	}
	if !foundAddIdx {
		t.Error("expected idx_users_email index add change")
	}

	if !strings.Contains(report.UpMigrationSQL, "BEGIN TRANSACTION;") {
		t.Error("expected UpMigrationSQL to wrap in transaction")
	}
	if !strings.Contains(report.DownMigrationSQL, "DROP TABLE IF EXISTS products;") {
		t.Error("expected DownMigrationSQL to contain rollback for products")
	}
}

func TestVdbeExplainer(t *testing.T) {
	conn, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open memory sqlite: %v", err)
	}
	defer conn.Close()

	ctx := context.Background()
	_, _ = conn.ExecContext(ctx, "CREATE TABLE items (id INT, val TEXT);")

	vdbe, err := ExplainVDBE(ctx, conn, "SELECT * FROM items WHERE id = 5")
	if err != nil {
		t.Fatalf("ExplainVDBE failed: %v", err)
	}

	if vdbe.TotalOpcodes == 0 {
		t.Error("expected opcodes in VDBE trace, got 0")
	}
	if vdbe.EstimatedComplexity == "" {
		t.Error("expected estimated complexity rating")
	}
}
