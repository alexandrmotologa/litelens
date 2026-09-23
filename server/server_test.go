package server

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/alexandrmotologa/litelens/pkg/db"
)

func setupTestServer(t *testing.T) (*httptest.Server, *db.Manager, func()) {
	tempDir, err := os.MkdirTemp("", "litelens-server-test-*")
	if err != nil {
		t.Fatalf("failed creating temp dir: %v", err)
	}

	dbPath := filepath.Join(tempDir, "test.db")
	mgr, err := db.Open(dbPath, false)
	if err != nil {
		t.Fatalf("failed opening test db: %v", err)
	}

	ctx := context.Background()
	_, _ = mgr.DB().ExecContext(ctx, `
		CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			email TEXT
		);
		INSERT INTO users (name, email) VALUES ('Alice', 'alice@test.com');
		INSERT INTO users (name, email) VALUES ('Bob', 'bob@test.com');
	`)

	handler := NewRouter(Config{
		Manager: mgr,
	})

	ts := httptest.NewServer(handler)

	cleanup := func() {
		ts.Close()
		mgr.Close()
		os.RemoveAll(tempDir)
	}

	return ts, mgr, cleanup
}

func TestAPISchema(t *testing.T) {
	ts, _, cleanup := setupTestServer(t)
	defer cleanup()

	resp, err := http.Get(ts.URL + "/api/schema")
	if err != nil {
		t.Fatalf("GET /api/schema failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK, got %d", resp.StatusCode)
	}

	var meta db.SchemaMetadata
	if err := json.NewDecoder(resp.Body).Decode(&meta); err != nil {
		t.Fatalf("failed decoding schema response: %v", err)
	}

	if len(meta.Tables) != 1 || meta.Tables[0].Name != "users" {
		t.Errorf("expected 1 table 'users', got %+v", meta.Tables)
	}
}

func TestAPITableData(t *testing.T) {
	ts, _, cleanup := setupTestServer(t)
	defer cleanup()

	resp, err := http.Get(ts.URL + "/api/tables/users/data?page=1&limit=10")
	if err != nil {
		t.Fatalf("GET /api/tables/users/data failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK, got %d", resp.StatusCode)
	}

	var data map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		t.Fatalf("failed decoding data: %v", err)
	}

	rows, ok := data["rows"].([]any)
	if !ok || len(rows) != 2 {
		t.Errorf("expected 2 rows, got %d", len(rows))
	}
}

func TestAPIQueryExecuteAndExplain(t *testing.T) {
	ts, _, cleanup := setupTestServer(t)
	defer cleanup()

	// 1. Execute query
	reqBody, _ := json.Marshal(map[string]string{"sql": "SELECT count(*) as count FROM users"})
	resp, err := http.Post(ts.URL+"/api/query/execute", "application/json", bytes.NewReader(reqBody))
	if err != nil {
		t.Fatalf("POST /api/query/execute failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK for execute, got %d", resp.StatusCode)
	}

	// 2. Explain query
	reqBody, _ = json.Marshal(map[string]string{"sql": "SELECT * FROM users WHERE name = 'Alice'"})
	resp, err = http.Post(ts.URL+"/api/query/explain", "application/json", bytes.NewReader(reqBody))
	if err != nil {
		t.Fatalf("POST /api/query/explain failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK for explain, got %d", resp.StatusCode)
	}
}

func TestAPIWalStatus(t *testing.T) {
	ts, _, cleanup := setupTestServer(t)
	defer cleanup()

	resp, err := http.Get(ts.URL + "/api/wal/status")
	if err != nil {
		t.Fatalf("GET /api/wal/status failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK, got %d", resp.StatusCode)
	}
}
