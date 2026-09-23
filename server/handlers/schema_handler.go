package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/alexandrmotologa/litelens/pkg/db"
	"github.com/go-chi/chi/v5"
)

// SchemaHandler provides endpoints for database schema metadata.
type SchemaHandler struct {
	mgr *db.Manager
}

// NewSchemaHandler creates a new SchemaHandler instance.
func NewSchemaHandler(mgr *db.Manager) *SchemaHandler {
	return &SchemaHandler{mgr: mgr}
}

// GetSchema returns the full schema metadata for the connected database.
func (h *SchemaHandler) GetSchema(w http.ResponseWriter, r *http.Request) {
	meta, err := h.mgr.IntrospectDatabase(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, meta)
}

// GetTableDetails returns detailed metadata for a single table.
func (h *SchemaHandler) GetTableDetails(w http.ResponseWriter, r *http.Request) {
	tableName := chi.URLParam(r, "tableName")
	if tableName == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "table name required"})
		return
	}

	tbl, err := h.mgr.IntrospectTable(r.Context(), tableName, "table", "")
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, tbl)
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
