package server

import (
	"io/fs"
	"net/http"

	"github.com/alexandrmotologa/litelens/pkg/db"
	"github.com/alexandrmotologa/litelens/server/handlers"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
)

// Config encapsulates server dependencies.
type Config struct {
	Manager  *db.Manager
	StaticFS fs.FS
}

// NewRouter sets up the Chi HTTP router and mounts all API and static handlers.
func NewRouter(cfg Config) http.Handler {
	r := chi.NewRouter()

	// Standard middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)

	// Cross-Origin Resource Sharing (CORS) for development UI and local workbench
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	schemaH := handlers.NewSchemaHandler(cfg.Manager)
	dataH := handlers.NewDataHandler(cfg.Manager)
	planH := handlers.NewPlanHandler(cfg.Manager)
	walH := handlers.NewWalHandler(cfg.Manager)
	diffH := handlers.NewDiffHandler(cfg.Manager)
	codecH := handlers.NewCodecHandler()
	doctorH := handlers.NewDoctorHandler(cfg.Manager)
	ftsH := handlers.NewFtsHandler(cfg.Manager)
	transferH := handlers.NewTransferHandler(cfg.Manager)

	// API Routes
	r.Route("/api", func(api chi.Router) {
		// Schema Introspection
		api.Get("/schema", schemaH.GetSchema)
		api.Get("/tables/{tableName}", schemaH.GetTableDetails)

		// Table Data & CRUD
		api.Get("/tables/{tableName}/data", dataH.GetTableData)
		api.Post("/tables/{tableName}/rows", dataH.InsertRow)
		api.Put("/tables/{tableName}/rows", dataH.UpdateRow)
		api.Delete("/tables/{tableName}/rows", dataH.DeleteRow)

		// Query Execution & Plan Analysis
		api.Post("/query/execute", planH.ExecuteQuery)
		api.Post("/query/explain", planH.ExplainQuery)

		// WAL Telemetry & Checkpoint
		api.Get("/wal/status", walH.GetStatus)
		api.Post("/wal/checkpoint", walH.ExecuteCheckpoint)
		api.Get("/wal/events", walH.StreamEvents)

		// Database Migration Diff
		api.Post("/diff", diffH.CompareDatabase)

		// Codecs & Diagnostics
		api.Post("/codec/blob", codecH.InspectBlob)
		api.Post("/codec/vector", codecH.CalcVectorDistances)

		// Doctor & Health Audit
		api.Get("/doctor/health", doctorH.GetHealth)
		api.Post("/doctor/vacuum", doctorH.ExecuteVacuum)

		// FTS5 Full-Text Search Studio
		api.Get("/fts/tables", ftsH.GetTables)
		api.Post("/fts/ddl", ftsH.GenerateDdl)
		api.Post("/fts/create", ftsH.CreateTable)

		// Import & Export Hub
		api.Get("/transfer/export", transferH.Export)
		api.Post("/transfer/import", transferH.Import)
	})

	// Static Web Client
	RegisterStaticRoutes(r, cfg.StaticFS)

	return r
}
