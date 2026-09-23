package cmd

import (
	"context"
	"fmt"
	"os"

	"github.com/alexandrmotologa/litelens/pkg/analyzer"
	"github.com/alexandrmotologa/litelens/pkg/db"
	"github.com/spf13/cobra"
)

var (
	diffOutput string
	diffCmd    = &cobra.Command{
		Use:   "diff <source_database> <target_database>",
		Short: "Compare two SQLite schemas and generate reversible DDL migrations",
		Args:  cobra.ExactArgs(2),
		RunE: func(cmd *cobra.Command, args []string) error {
			srcPath := args[0]
			dstPath := args[1]

			ctx := context.Background()

			srcMgr, err := db.Open(srcPath, true)
			if err != nil {
				return fmt.Errorf("failed opening source database %s: %w", srcPath, err)
			}
			defer srcMgr.Close()

			dstMgr, err := db.Open(dstPath, true)
			if err != nil {
				return fmt.Errorf("failed opening target database %s: %w", dstPath, err)
			}
			defer dstMgr.Close()

			srcSchema, err := srcMgr.IntrospectDatabase(ctx)
			if err != nil {
				return fmt.Errorf("failed introspecting source database: %w", err)
			}

			dstSchema, err := dstMgr.IntrospectDatabase(ctx)
			if err != nil {
				return fmt.Errorf("failed introspecting target database: %w", err)
			}

			report := analyzer.CompareSchemas(srcSchema, dstSchema)

			fmt.Println("================================================================")
			fmt.Println("  LiteLens Database Schema Migration Diff")
			fmt.Println("================================================================")
			fmt.Printf("Source Database: %s\n", srcPath)
			fmt.Printf("Target Database: %s\n", dstPath)
			fmt.Printf("Total Changes:   %d\n\n", report.TotalChanges)

			if report.TotalChanges == 0 {
				fmt.Println("Databases have identical schema structures.")
				return nil
			}

			fmt.Println("DETECTED CHANGES:")
			for i, ch := range report.Changes {
				fmt.Printf("  %d. [%s] %s (%s)\n", i+1, ch.Type, ch.Description, ch.EntityType)
			}

			if diffOutput != "" {
				if err := os.WriteFile(diffOutput, []byte(report.UpMigrationSQL), 0644); err != nil {
					return fmt.Errorf("failed writing migration script to %s: %w", diffOutput, err)
				}
				fmt.Printf("\nGenerated UP migration script saved to: %s\n", diffOutput)
			} else {
				fmt.Println("\nUP MIGRATION SQL:")
				fmt.Println("----------------------------------------------------------------")
				fmt.Println(report.UpMigrationSQL)
				fmt.Println("----------------------------------------------------------------")
			}

			return nil
		},
	}
)

func init() {
	diffCmd.Flags().StringVarP(&diffOutput, "output", "o", "", "File path to save the generated UP migration SQL script")
	rootCmd.AddCommand(diffCmd)
}
