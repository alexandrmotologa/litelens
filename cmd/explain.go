package cmd

import (
	"context"
	"fmt"
	"strings"

	"github.com/alexandrmotologa/litelens/pkg/analyzer"
	"github.com/alexandrmotologa/litelens/pkg/db"
	"github.com/spf13/cobra"
)

var explainCmd = &cobra.Command{
	Use:   "explain <database_path> <sql_query>",
	Short: "Analyze query execution plan and recommend optimal indexes",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		dbPath := args[0]
		query := args[1]

		mgr, err := db.Open(dbPath, true)
		if err != nil {
			return fmt.Errorf("failed opening database: %w", err)
		}
		defer mgr.Close()

		ctx := context.Background()
		graph, err := analyzer.ExplainQueryPlan(ctx, mgr.DB(), query)
		if err != nil {
			return fmt.Errorf("query plan analysis failed: %w", err)
		}

		schema, _ := mgr.IntrospectDatabase(ctx)
		var tables []db.TableInfo
		if schema != nil {
			tables = schema.Tables
		}

		advisor := analyzer.NewAdvisor()
		recs := advisor.AnalyzeQuery(query, graph, tables)

		fmt.Println("================================================================")
		fmt.Println("  LiteLens Query Execution Plan & Index Advisor")
		fmt.Println("================================================================")
		fmt.Printf("Database: %s\n", dbPath)
		fmt.Printf("Query:    %s\n\n", query)

		fmt.Println("EXPLAIN QUERY PLAN:")
		for _, node := range graph.Nodes {
			prefix := "  • "
			switch node.CostRating {
			case analyzer.CostDanger:
				prefix = "  [DANGER - TABLE SCAN] "
			case analyzer.CostWarning:
				prefix = "  [WARNING - TEMP SORT] "
			case analyzer.CostGood:
				prefix = "  [OPTIMAL - INDEX]     "
			}
			fmt.Printf("%s%s\n", prefix, node.Detail)
		}

		fmt.Println("\nMETRICS:")
		fmt.Printf("  Optimization Score: %d / 100\n", graph.OptimizationScore)
		fmt.Printf("  Full Table Scans:   %d\n", graph.FullTableScans)
		fmt.Printf("  Temporary B-Trees:  %d\n", graph.TempBTrees)
		fmt.Printf("  Index Lookups:      %d\n", graph.IndexLookups)

		if len(recs) > 0 {
			fmt.Println("\nINDEX ADVISOR RECOMMENDATIONS:")
			for i, r := range recs {
				fmt.Printf("  %d. Table: %s\n", i+1, r.Table)
				fmt.Printf("     Columns: %s\n", strings.Join(r.Columns, ", "))
				fmt.Printf("     Reason:  %s\n", r.Reason)
				fmt.Printf("     SQL:     %s\n\n", r.DDL)
			}
		} else {
			fmt.Println("\nIndex Advisor: No missing indexes detected. Query appears optimized.")
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(explainCmd)
}
