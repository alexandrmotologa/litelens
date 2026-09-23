package server

import (
	"io/fs"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
)

// StaticAssets holds the embedded frontend filesystem.
var StaticAssets fs.FS

// RegisterStaticRoutes mounts the static asset filesystem to the router.
func RegisterStaticRoutes(r chi.Router, staticFS fs.FS) {
	if staticFS == nil {
		r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Write([]byte(`<!DOCTYPE html>
<html>
<head><title>LiteLens Studio</title><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="font-family: system-ui, sans-serif; background: #0b0f19; color: #f3f4f6; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
  <div style="text-align: center; max-width: 500px; padding: 2rem;">
    <h1 style="color: #60a5fa; margin-bottom: 0.5rem;">LiteLens Studio API Active</h1>
    <p style="color: #9ca3af; font-size: 0.95rem;">Backend engine is running in headless mode or UI build is in progress.</p>
    <a href="/api/schema" style="display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; background: #1e293b; color: #38bdf8; text-decoration: none; border-radius: 6px; font-weight: 500;">Inspect /api/schema</a>
  </div>
</body>
</html>`))
		})
		return
	}

	fileServer := http.FileServer(http.FS(staticFS))
	r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path == "" {
			path = "index.html"
		}

		// Check if file exists in FS
		f, err := staticFS.Open(path)
		if err == nil {
			_ = f.Close()
			fileServer.ServeHTTP(w, r)
			return
		}

		// Fallback to index.html for Single-Page App (SPA) client-side routing
		indexFile, err := staticFS.Open("index.html")
		if err == nil {
			_ = indexFile.Close()
			r.URL.Path = "/"
			fileServer.ServeHTTP(w, r)
			return
		}

		http.NotFound(w, r)
	})
}
