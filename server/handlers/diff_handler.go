package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/alexandrmotologa/litelens/pkg/analyzer"
	"github.com/alexandrmotologa/litelens/pkg/db"
)

// DiffHandler handles database schema diffs and migration generation.
type DiffHandler struct {
	mgr *db.Manager
}

// NewDiffHandler creates a new DiffHandler.
func NewDiffHandler(mgr *db.Manager) *DiffHandler {
	return &DiffHandler{mgr: mgr}
}

// DiffRequest defines the target database file to compare against.
type DiffRequest struct {
	TargetPath string `json:"targetPath"`
}

// CompareDatabase compares the currently opened database with a target database file.
func (h *DiffHandler) CompareDatabase(w http.ResponseWriter, r *http.Request) {
	var req DiffRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
		return
	}

	if req.TargetPath == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "targetPath is required"})
		return
	}

	currentSchema, err := h.mgr.IntrospectDatabase(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed introspecting current schema: " + err.Error()})
		return
	}

	targetMgr, err := db.Open(req.TargetPath, true)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "failed opening target database: " + err.Error()})
		return
	}
	defer targetMgr.Close()

	targetSchema, err := targetMgr.IntrospectDatabase(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed introspecting target schema: " + err.Error()})
		return
	}

	report := analyzer.CompareSchemas(currentSchema, targetSchema)
	writeJSON(w, http.StatusOK, report)
}
