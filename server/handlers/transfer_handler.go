package handlers

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/alexandrmotologa/litelens/pkg/db"
	"github.com/alexandrmotologa/litelens/pkg/transfer"
)

// TransferHandler provides import and export HTTP endpoints.
type TransferHandler struct {
	mgr *db.Manager
}

// NewTransferHandler creates a new TransferHandler instance.
func NewTransferHandler(mgr *db.Manager) *TransferHandler {
	return &TransferHandler{mgr: mgr}
}

// Export streams database data as SQL dump, CSV, or JSONL.
func (h *TransferHandler) Export(w http.ResponseWriter, r *http.Request) {
	format := strings.ToLower(r.URL.Query().Get("format"))
	table := r.URL.Query().Get("table")

	switch format {
	case "csv":
		if table == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "table parameter required for CSV export"})
			return
		}
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.csv\"", table))
		if err := transfer.ExportCsv(r.Context(), h.mgr.DB(), table, w); err != nil {
			// Headers already sent if streaming, but try reporting if not
			return
		}

	case "jsonl":
		if table == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "table parameter required for JSONL export"})
			return
		}
		w.Header().Set("Content-Type", "application/x-ndjson; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s.jsonl\"", table))
		if err := transfer.ExportJsonl(r.Context(), h.mgr.DB(), table, w); err != nil {
			return
		}

	case "sql", "":
		filename := "dump.sql"
		var tables []string
		if table != "" {
			filename = fmt.Sprintf("%s.sql", table)
			tables = []string{table}
		}
		w.Header().Set("Content-Type", "application/sql; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
		if err := transfer.GenerateSqlDump(r.Context(), h.mgr.DB(), w, tables); err != nil {
			return
		}

	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unsupported export format (use sql, csv, or jsonl)"})
	}
}

// Import parses an uploaded CSV or JSON file and inserts records into the database.
func (h *TransferHandler) Import(w http.ResponseWriter, r *http.Request) {
	if h.mgr.IsReadOnly() {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "database is opened in read-only mode"})
		return
	}

	table := r.URL.Query().Get("table")
	format := strings.ToLower(r.URL.Query().Get("format"))
	createTable := r.URL.Query().Get("createTable") == "true"

	var reader io.Reader = r.Body
	defer r.Body.Close()

	// Check if multipart form upload
	contentType := r.Header.Get("Content-Type")
	if strings.HasPrefix(contentType, "multipart/form-data") {
		if err := r.ParseMultipartForm(32 << 20); err == nil {
			file, header, err := r.FormFile("file")
			if err == nil {
				defer file.Close()
				reader = file

				if format == "" {
					fn := strings.ToLower(header.Filename)
					if strings.HasSuffix(fn, ".csv") {
						format = "csv"
					} else if strings.HasSuffix(fn, ".json") || strings.HasSuffix(fn, ".jsonl") {
						format = "json"
					}
				}

				if table == "" {
					fn := header.Filename
					dotIdx := strings.LastIndex(fn, ".")
					if dotIdx > 0 {
						table = fn[:dotIdx]
					} else {
						table = fn
					}
				}
			}
		}
	}

	if table == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "table parameter or file upload required"})
		return
	}

	if format == "csv" {
		result, err := transfer.ImportCsv(r.Context(), h.mgr.DB(), table, reader, createTable)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, http.StatusOK, result)
		return
	}

	// Default to JSON
	result, err := transfer.ImportJson(r.Context(), h.mgr.DB(), table, reader, createTable)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, result)
}
