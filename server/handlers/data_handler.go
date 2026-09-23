package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/alexandrmotologa/litelens/pkg/db"
	"github.com/go-chi/chi/v5"
)

// DataHandler handles paginated table data and row manipulation.
type DataHandler struct {
	mgr *db.Manager
}

// NewDataHandler creates a new DataHandler.
func NewDataHandler(mgr *db.Manager) *DataHandler {
	return &DataHandler{mgr: mgr}
}

// PaginatedDataResponse wraps rows and pagination metadata.
type PaginatedDataResponse struct {
	TableName   string           `json:"tableName"`
	Page        int              `json:"page"`
	Limit       int              `json:"limit"`
	TotalRows   int64            `json:"totalRows"`
	Columns     []string         `json:"columns"`
	ColumnTypes []string         `json:"columnTypes"`
	Rows        []map[string]any `json:"rows"`
	DurationMs  float64          `json:"durationMs"`
}

// GetTableData returns paginated rows for the requested table.
func (h *DataHandler) GetTableData(w http.ResponseWriter, r *http.Request) {
	tableName := chi.URLParam(r, "tableName")
	if tableName == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "table name required"})
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 1000 {
		limit = 50
	}
	offset := (page - 1) * limit

	sortCol := r.URL.Query().Get("sort")
	order := strings.ToUpper(r.URL.Query().Get("order"))
	if order != "DESC" {
		order = "ASC"
	}

	filter := r.URL.Query().Get("filter")

	escapedTable := fmt.Sprintf(`"%s"`, strings.ReplaceAll(tableName, `"`, `""`))

	// Get total row count
	var totalRows int64
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s", escapedTable)
	if filter != "" {
		countQuery += fmt.Sprintf(" WHERE %s", filter)
	}
	_ = h.mgr.DB().QueryRowContext(r.Context(), countQuery).Scan(&totalRows)

	// Build query
	var queryBuilder strings.Builder
	queryBuilder.WriteString(fmt.Sprintf("SELECT * FROM %s", escapedTable))
	if filter != "" {
		queryBuilder.WriteString(fmt.Sprintf(" WHERE %s", filter))
	}
	if sortCol != "" {
		escapedSort := fmt.Sprintf(`"%s"`, strings.ReplaceAll(sortCol, `"`, `""`))
		queryBuilder.WriteString(fmt.Sprintf(" ORDER BY %s %s", escapedSort, order))
	}
	queryBuilder.WriteString(fmt.Sprintf(" LIMIT %d OFFSET %d", limit, offset))

	res, err := h.mgr.ExecuteQuery(r.Context(), queryBuilder.String())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	resp := PaginatedDataResponse{
		TableName:   tableName,
		Page:        page,
		Limit:       limit,
		TotalRows:   totalRows,
		Columns:     res.Columns,
		ColumnTypes: res.ColumnTypes,
		Rows:        res.Rows,
		DurationMs:  res.DurationMs,
	}

	writeJSON(w, http.StatusOK, resp)
}

// InsertRowRequest defines the payload for inserting a new row.
type InsertRowRequest struct {
	Values map[string]any `json:"values"`
}

// InsertRow inserts a row into the specified table.
func (h *DataHandler) InsertRow(w http.ResponseWriter, r *http.Request) {
	if h.mgr.IsReadOnly() {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "read-only mode active"})
		return
	}

	tableName := chi.URLParam(r, "tableName")
	var req InsertRowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
		return
	}

	if len(req.Values) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "no values provided"})
		return
	}

	cols := make([]string, 0, len(req.Values))
	placeholders := make([]string, 0, len(req.Values))
	args := make([]any, 0, len(req.Values))

	for col, val := range req.Values {
		cols = append(cols, fmt.Sprintf(`"%s"`, strings.ReplaceAll(col, `"`, `""`)))
		placeholders = append(placeholders, "?")
		args = append(args, val)
	}

	escapedTable := fmt.Sprintf(`"%s"`, strings.ReplaceAll(tableName, `"`, `""`))
	stmt := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)",
		escapedTable,
		strings.Join(cols, ", "),
		strings.Join(placeholders, ", "),
	)

	affected, err := h.mgr.ExecuteStatement(r.Context(), stmt, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{"rowsAffected": affected})
}

// UpdateRowRequest defines payload to update a row based on primary key filter.
type UpdateRowRequest struct {
	Where  map[string]any `json:"where"`
	Values map[string]any `json:"values"`
}

// UpdateRow updates matching row(s).
func (h *DataHandler) UpdateRow(w http.ResponseWriter, r *http.Request) {
	if h.mgr.IsReadOnly() {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "read-only mode active"})
		return
	}

	tableName := chi.URLParam(r, "tableName")
	var req UpdateRowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
		return
	}

	if len(req.Where) == 0 || len(req.Values) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "both 'where' and 'values' are required"})
		return
	}

	setClauses := make([]string, 0, len(req.Values))
	args := make([]any, 0, len(req.Values)+len(req.Where))

	for col, val := range req.Values {
		setClauses = append(setClauses, fmt.Sprintf(`"%s" = ?`, strings.ReplaceAll(col, `"`, `""`)))
		args = append(args, val)
	}

	whereClauses := make([]string, 0, len(req.Where))
	for col, val := range req.Where {
		whereClauses = append(whereClauses, fmt.Sprintf(`"%s" = ?`, strings.ReplaceAll(col, `"`, `""`)))
		args = append(args, val)
	}

	escapedTable := fmt.Sprintf(`"%s"`, strings.ReplaceAll(tableName, `"`, `""`))
	stmt := fmt.Sprintf("UPDATE %s SET %s WHERE %s",
		escapedTable,
		strings.Join(setClauses, ", "),
		strings.Join(whereClauses, " AND "),
	)

	affected, err := h.mgr.ExecuteStatement(r.Context(), stmt, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"rowsAffected": affected})
}

// DeleteRowRequest defines primary key filter for deletion.
type DeleteRowRequest struct {
	Where map[string]any `json:"where"`
}

// DeleteRow deletes a row matching the where conditions.
func (h *DataHandler) DeleteRow(w http.ResponseWriter, r *http.Request) {
	if h.mgr.IsReadOnly() {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "read-only mode active"})
		return
	}

	tableName := chi.URLParam(r, "tableName")
	var req DeleteRowRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON payload"})
		return
	}

	if len(req.Where) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "'where' conditions required"})
		return
	}

	whereClauses := make([]string, 0, len(req.Where))
	args := make([]any, 0, len(req.Where))

	for col, val := range req.Where {
		whereClauses = append(whereClauses, fmt.Sprintf(`"%s" = ?`, strings.ReplaceAll(col, `"`, `""`)))
		args = append(args, val)
	}

	escapedTable := fmt.Sprintf(`"%s"`, strings.ReplaceAll(tableName, `"`, `""`))
	stmt := fmt.Sprintf("DELETE FROM %s WHERE %s", escapedTable, strings.Join(whereClauses, " AND "))

	affected, err := h.mgr.ExecuteStatement(r.Context(), stmt, args...)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"rowsAffected": affected})
}
