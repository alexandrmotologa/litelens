# Query Plan Representation and Index Heuristics

SQLite provides the `EXPLAIN QUERY PLAN` command to describe how the SQLite query optimizer executes a SQL statement. The raw output is a textual hierarchy of execution steps. LiteLens parses this hierarchy into an interactive Directed Acyclic Graph (DAG) and applies static rules to suggest missing indexes.

## Query Plan Output Format

Running `EXPLAIN QUERY PLAN <sql>` returns four columns:
1. `id`: Step identifier integer.
2. `parent`: Identifier of the parent operation.
3. `notused`: Deprecated column.
4. `detail`: Text description of the execution step.

Examples of step details:
* `SCAN TABLE users`: Full table scan through every row. High cost on large tables.
* `SEARCH TABLE users USING INDEX idx_users_email (email=?)`: Direct B-Tree lookup using an index.
* `USE TEMP B-TREE FOR ORDER BY`: An in-memory temporary B-Tree created to sort results because no index matches the `ORDER BY` columns.
* `COMPOUND SUBQUERIES ...`: Set operations (`UNION`, `EXCEPT`, `INTERSECT`).

## Node Classification in the Visual Graph

LiteLens assigns every plan node a category:
* **Green (Indexed Search):** Lookups that utilize an existing B-tree index.
* **Yellow (Temporary Sort or Subquery):** Operations requiring extra memory allocations, such as temporary B-tree creation for grouping or ordering.
* **Red (Full Table Scan):** Sequential scans through unindexed tables.

## Index Advisor Rules

The Index Advisor analyzes nodes flagged as full table scans:
1. Extract the target table name from the `SCAN TABLE` or unindexed `SEARCH TABLE` message.
2. Analyze the AST of the input SQL statement to find equality predicates in `WHERE` and `ON` clauses.
3. Analyze `ORDER BY` column lists.
4. Construct a candidate composite index:
   ```sql
   CREATE INDEX idx_<table_name>_<columns> ON <table_name>(<equality_columns>, <order_columns>);
   ```
5. Check if an identical or prefix-matching index already exists in the database schema before suggesting the new index.
