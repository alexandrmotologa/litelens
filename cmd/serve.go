package cmd

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/alexandrmotologa/litelens/pkg/db"
	"github.com/alexandrmotologa/litelens/server"
	"github.com/spf13/cobra"
)

var serveCmd = &cobra.Command{
	Use:   "serve [database_path]",
	Short: "Start the LiteLens web management studio",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		dbPath := "app.db"
		if len(args) > 0 {
			dbPath = args[0]
		}
		return runServe(dbPath, port, host, noBrowser, readOnly)
	},
}

func init() {
	rootCmd.AddCommand(serveCmd)
}

func runServe(dbPath string, port int, host string, noBrowser bool, readOnly bool) error {
	// If file does not exist and not in read-only mode, it will be created by SQLite
	if _, err := os.Stat(dbPath); os.IsNotExist(err) && readOnly {
		return fmt.Errorf("database file %s does not exist; cannot open in read-only mode", dbPath)
	}

	mgr, err := db.Open(dbPath, readOnly)
	if err != nil {
		return fmt.Errorf("failed opening database: %w", err)
	}
	defer mgr.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	meta, err := mgr.IntrospectDatabase(ctx)
	if err != nil {
		fmt.Printf("Warning: initial schema introspection returned error: %v\n", err)
	}

	tableCount := 0
	viewCount := 0
	if meta != nil {
		tableCount = len(meta.Tables)
		viewCount = len(meta.Views)
	}

	router := server.NewRouter(server.Config{
		Manager:  mgr,
		StaticFS: server.StaticAssets,
	})

	addr := fmt.Sprintf("%s:%d", host, port)
	httpServer := &http.Server{
		Addr:    addr,
		Handler: router,
	}

	serverURL := fmt.Sprintf("http://%s", addr)
	if host == "0.0.0.0" {
		serverURL = fmt.Sprintf("http://localhost:%d", port)
	}

	fmt.Println("----------------------------------------------------------------")
	fmt.Println("  LiteLens — SQLite 3.45+ Observability Studio & Concurrency Engine")
	fmt.Println("----------------------------------------------------------------")
	fmt.Printf("  Target Database: %s\n", dbPath)
	fmt.Printf("  Mode:            %s\n", map[bool]string{true: "Read-Only (Secure)", false: "Read-Write (WAL)"}[readOnly])
	fmt.Printf("  Schema:          %d tables, %d views\n", tableCount, viewCount)
	fmt.Printf("  Studio URL:      %s\n", serverURL)
	fmt.Println("----------------------------------------------------------------")
	fmt.Println("Press Ctrl+C to stop the studio.")

	if !noBrowser {
		go func() {
			time.Sleep(350 * time.Millisecond)
			_ = openBrowser(serverURL)
		}()
	}

	stopChan := make(chan os.Signal, 1)
	signal.Notify(stopChan, os.Interrupt, syscall.SIGTERM)

	go func() {
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Fprintf(os.Stderr, "Server error: %v\n", err)
		}
	}()

	<-stopChan
	fmt.Println("\nShutting down LiteLens studio gracefully...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	return httpServer.Shutdown(shutdownCtx)
}

func openBrowser(url string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	return cmd.Start()
}
