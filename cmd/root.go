package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var (
	port        int
	host        string
	noBrowser   bool
	readOnly    bool
	rootCmd     = &cobra.Command{
		Use:   "litelens [database_path]",
		Short: "LiteLens is an observability studio and diagnostic engine for modern SQLite 3.45+",
		Long: `LiteLens provides Write-Ahead Log concurrency diagnostics, visual query plan DAGs,
automated index advice, vector embedding search, and database schema diffing for modern SQLite databases.`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			dbPath := "app.db"
			if len(args) > 0 {
				dbPath = args[0]
			}
			return runServe(dbPath, port, host, noBrowser, readOnly)
		},
	}
)

// Execute runs the root CLI command.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().IntVarP(&port, "port", "p", 52000, "HTTP server port")
	rootCmd.PersistentFlags().StringVar(&host, "host", "127.0.0.1", "HTTP server bind address")
	rootCmd.PersistentFlags().BoolVar(&noBrowser, "no-browser", false, "Do not automatically launch web browser")
	rootCmd.PersistentFlags().BoolVar(&readOnly, "read-only", false, "Open database in strict read-only mode")
}
