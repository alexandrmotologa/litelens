package cmd

import (
	"context"
	"fmt"

	"github.com/alexandrmotologa/litelens/pkg/db"
	"github.com/spf13/cobra"
)

var (
	chkMode       string
	checkpointCmd = &cobra.Command{
		Use:   "checkpoint <database_path>",
		Short: "Execute an immediate SQLite WAL checkpoint",
		Args:  cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			dbPath := args[0]

			mgr, err := db.Open(dbPath, false)
			if err != nil {
				return fmt.Errorf("failed opening database: %w", err)
			}
			defer mgr.Close()

			ctx := context.Background()
			res, err := mgr.ExecuteCheckpoint(ctx, chkMode)
			if err != nil {
				return fmt.Errorf("checkpoint execution failed: %w", err)
			}

			fmt.Println("================================================================")
			fmt.Println("  LiteLens SQLite WAL Checkpoint")
			fmt.Println("================================================================")
			fmt.Printf("Database:           %s\n", dbPath)
			fmt.Printf("Mode:               %s\n", res.Mode)
			fmt.Printf("Busy:               %d\n", res.Busy)
			fmt.Printf("Log Frames:         %d\n", res.Log)
			fmt.Printf("Checkpointed Frames: %d\n", res.Checkpointed)
			fmt.Printf("Duration:           %.2f ms\n", res.DurationMs)

			return nil
		},
	}
)

func init() {
	checkpointCmd.Flags().StringVarP(&chkMode, "mode", "m", "PASSIVE", "Checkpoint mode: PASSIVE, FULL, RESTART, TRUNCATE")
	rootCmd.AddCommand(checkpointCmd)
}
