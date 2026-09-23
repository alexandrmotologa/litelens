package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/alexandrmotologa/litelens/pkg/db"
	"github.com/alexandrmotologa/litelens/pkg/fts"
)

// FtsHandler provides endpoints for FTS5 full-text search detection and creation.
type FtsHandler struct {
	mgr *db.Manager
}

// NewFtsHandler creates a new FtsHandler instance.
func NewFtsHandler(mgr *db.Manager) *FtsHandler {
	return &FtsHandler{mgr: mgr}
}

// GetTables returns all detected FTS5 virtual tables.
func (h *FtsHandler) GetTables(w http.ResponseWriter, r *http.Request) {
	tables, err := fts.DetectFtsTables(r.Context(), h.mgr.DB())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, tables)
}

// GenerateDdl generates FTS5 DDL and synchronization triggers without executing them.
func (h *FtsHandler) GenerateDdl(w http.ResponseWriter, r *http.Request) {
	var req fts.CreateFtsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	res, err := fts.GenerateFtsDdl(req)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, res)
}

// CreateTable generates and executes FTS5 table creation and trigger statements.
func (h *FtsHandler) CreateTable(w http.ResponseWriter, r *http.Request) {
	if h.mgr.IsReadOnly() {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "database is opened in read-only mode"})
		return
	}

	var req fts.CreateFtsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	res, err := fts.GenerateFtsDdl(req)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	tx, err := h.mgr.DB().BeginTx(r.Context(), nil)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(r.Context(), res.CreateSql); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed creating FTS table: " + err.Error()})
		return
	}

	if res.PopulateSql != "" {
		if _, err := tx.ExecContext(r.Context(), res.PopulateSql); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed populating FTS table: " + err.Error()})
			return
		}
	}

	for _, trg := range res.TriggersSql {
		if _, err := tx.ExecContext(r.Context(), trg); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed creating sync trigger: " + err.Error()})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"success": true, "result": res})
}
