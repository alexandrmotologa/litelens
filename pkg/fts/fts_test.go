package fts

import (
	"context"
	"database/sql"
	"strings"
	"testing"

	_ "modernc.org/sqlite"
)

func TestGenerateFtsDdl(t *testing.T) {
	req := CreateFtsRequest{
		FtsTableName: "articles_fts",
		SourceTable:  "articles",
		Columns:      []string{"title", "body"},
		Tokenizer:    "porter unicode61",
		WithTriggers: true,
		PopulateData: true,
	}

	res, err := GenerateFtsDdl(req)
	if err != nil {
		t.Fatalf("GenerateFtsDdl failed: %v", err)
	}

	if !strings.Contains(res.CreateSql, "USING fts5(\"title\", \"body\", tokenize = 'porter unicode61')") {
		t.Errorf("unexpected createSql: %s", res.CreateSql)
	}

	if len(res.TriggersSql) != 3 {
		t.Fatalf("expected 3 triggers, got %d", len(res.TriggersSql))
	}

	if !strings.Contains(res.PopulateSql, "INSERT INTO \"articles_fts\"") {
		t.Errorf("unexpected populateSql: %s", res.PopulateSql)
	}
}

func TestDetectFtsTables(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("open db failed: %v", err)
	}
	defer db.Close()
	db.SetMaxOpenConns(1)

	if _, err := db.Exec("CREATE VIRTUAL TABLE docs_fts USING fts5(title, content, tokenize='porter unicode61');"); err != nil {
		t.Fatalf("create fts failed: %v", err)
	}
	if _, err := db.Exec("INSERT INTO docs_fts(title, content) VALUES ('Doc 1', 'Quick brown fox jumps');"); err != nil {
		t.Fatalf("insert fts failed: %v", err)
	}

	tables, err := DetectFtsTables(context.Background(), db)
	if err != nil {
		t.Fatalf("DetectFtsTables failed: %v", err)
	}

	t.Logf("Detected tables: %+v", tables)
	if len(tables) != 1 {
		t.Fatalf("expected 1 fts table, got %d", len(tables))
	}
	if tables[0].Name != "docs_fts" {
		t.Errorf("expected docs_fts, got %s", tables[0].Name)
	}
	if tables[0].RowCount != 1 {
		t.Errorf("expected 1 row, got %d", tables[0].RowCount)
	}
}
