package doctor

import (
	"context"
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
)

func TestHealthAudit(t *testing.T) {
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatalf("failed to open memory sqlite: %v", err)
	}
	defer db.Close()

	ctx := context.Background()

	// Schema with intentional foreign key violation to test detector
	ddl := `
	PRAGMA foreign_keys = OFF;

	CREATE TABLE departments (
		id INTEGER PRIMARY KEY,
		name TEXT
	);

	CREATE TABLE employees (
		id INTEGER PRIMARY KEY,
		name TEXT,
		dept_id INTEGER,
		FOREIGN KEY (dept_id) REFERENCES departments(id)
	);

	INSERT INTO departments VALUES (1, 'Engineering');
	INSERT INTO employees VALUES (101, 'Alice', 1);
	INSERT INTO employees VALUES (102, 'Bob', 999); -- Orphaned FK!
	`

	if _, err := db.ExecContext(ctx, ddl); err != nil {
		t.Fatalf("DDL setup failed: %v", err)
	}

	report, err := RunHealthAudit(ctx, db)
	if err != nil {
		t.Fatalf("RunHealthAudit failed: %v", err)
	}

	if !report.QuickCheckOk {
		t.Error("expected quick check to be OK")
	}
	if !report.IntegrityOk {
		t.Error("expected integrity check to be OK")
	}

	if len(report.ForeignKeyViolations) != 1 {
		t.Fatalf("expected 1 foreign key violation, got %d", len(report.ForeignKeyViolations))
	}

	violation := report.ForeignKeyViolations[0]
	if violation.TableName != "employees" || violation.ParentTable != "departments" {
		t.Errorf("unexpected violation details: %+v", violation)
	}

	// Test Vacuum
	if err := ExecuteVacuum(ctx, db, ""); err != nil {
		t.Errorf("vacuum failed: %v", err)
	}
}
