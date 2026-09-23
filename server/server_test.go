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

func TestAPIDoctorHealth(t *testing.T) {
	ts, _, cleanup := setupTestServer(t)
	defer cleanup()

	resp, err := http.Get(ts.URL + "/api/doctor/health")
	if err != nil {
		t.Fatalf("GET /api/doctor/health failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK, got %d", resp.StatusCode)
	}

	var rep map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&rep); err != nil {
		t.Fatalf("failed decoding doctor response: %v", err)
	}
	if score, ok := rep["healthScore"].(float64); !ok || score <= 0 {
		t.Errorf("expected positive healthScore, got %v", rep["healthScore"])
	}
}

func TestAPIFts(t *testing.T) {
	ts, _, cleanup := setupTestServer(t)
	defer cleanup()

	// 1. Get FTS tables (should be empty initially)
	resp, err := http.Get(ts.URL + "/api/fts/tables")
	if err != nil {
		t.Fatalf("GET /api/fts/tables failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK, got %d", resp.StatusCode)
	}

	// 2. Generate DDL
	reqBody, _ := json.Marshal(map[string]any{
		"ftsTableName": "users_fts",
		"sourceTable":  "users",
		"columns":      []string{"name", "email"},
		"withTriggers": true,
		"populateData": true,
	})
	resp, err = http.Post(ts.URL+"/api/fts/create", "application/json", bytes.NewReader(reqBody))
	if err != nil {
		t.Fatalf("POST /api/fts/create failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK for fts create, got %d", resp.StatusCode)
	}
}

func TestAPITransfer(t *testing.T) {
	ts, _, cleanup := setupTestServer(t)
	defer cleanup()

	// 1. Export CSV
	resp, err := http.Get(ts.URL + "/api/transfer/export?table=users&format=csv")
	if err != nil {
		t.Fatalf("export csv failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK for export, got %d", resp.StatusCode)
	}

	// 2. Import JSON
	jsonData := `[{"name": "Charlie", "email": "charlie@test.com"}]`
	resp, err = http.Post(ts.URL+"/api/transfer/import?table=new_users&createTable=true&format=json", "application/json", bytes.NewReader([]byte(jsonData)))
	if err != nil {
		t.Fatalf("import json failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200 OK for import, got %d", resp.StatusCode)
	}
}
