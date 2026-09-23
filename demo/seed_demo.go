package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"os"

	"github.com/alexandrmotologa/litelens/pkg/types"
	_ "modernc.org/sqlite"
)

func main() {
	dbPath := "demo.db"
	_ = os.Remove(dbPath)
	_ = os.Remove(dbPath + "-wal")
	_ = os.Remove(dbPath + "-shm")

	db, err := sql.Open("sqlite", "file:"+dbPath+"?_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)")
	if err != nil {
		log.Fatalf("failed to open: %v", err)
	}
	defer db.Close()

	ctx := context.Background()

	ddl := `
	CREATE TABLE users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		username TEXT NOT NULL UNIQUE,
		email TEXT NOT NULL UNIQUE,
		full_name TEXT NOT NULL,
		role TEXT DEFAULT 'member',
		country TEXT DEFAULT 'US',
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE TABLE orders (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		status TEXT DEFAULT 'pending',
		total_amount REAL NOT NULL,
		currency TEXT DEFAULT 'USD',
		tracking_number TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
	);

	CREATE TABLE products (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		sku TEXT NOT NULL UNIQUE,
		title TEXT NOT NULL,
		category TEXT NOT NULL,
		price REAL NOT NULL,
		stock INTEGER DEFAULT 0,
		embedding BLOB
	);

	CREATE TABLE audit_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		action TEXT NOT NULL,
		actor TEXT NOT NULL,
		payload TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX idx_users_role ON users(role);
	CREATE INDEX idx_products_category ON products(category);

	CREATE VIEW v_recent_orders AS
		SELECT o.id, u.username, u.email, o.total_amount, o.status, o.created_at
		FROM orders o
		JOIN users u ON o.user_id = u.id
		ORDER BY o.created_at DESC;

	CREATE TRIGGER trg_order_audit AFTER INSERT ON orders
	BEGIN
		INSERT INTO audit_logs (action, actor, payload)
		VALUES ('CREATE_ORDER', 'system', '{"order_id": ' || new.id || ', "amount": ' || new.total_amount || '}');
	END;
	`

	if _, err := db.ExecContext(ctx, ddl); err != nil {
		log.Fatalf("failed creating schema: %v", err)
	}

	// Insert Users
	roles := []string{"admin", "member", "editor", "guest"}
	countries := []string{"US", "RO", "DE", "FR", "UK", "CA", "JP"}
	for i := 1; i <= 60; i++ {
		username := fmt.Sprintf("user_%03d", i)
		email := fmt.Sprintf("%s@example.com", username)
		fullName := fmt.Sprintf("Person %d", i)
		role := roles[rand.Intn(len(roles))]
		country := countries[rand.Intn(len(countries))]

		_, err := db.ExecContext(ctx, "INSERT INTO users (username, email, full_name, role, country) VALUES (?, ?, ?, ?, ?)",
			username, email, fullName, role, country)
		if err != nil {
			log.Fatalf("insert user failed: %v", err)
		}
	}

	// Insert Products with float32 vector embeddings
	categories := []string{"Electronics", "Audio", "Developer Tools", "Office", "Peripherals"}
	for i := 1; i <= 40; i++ {
		sku := fmt.Sprintf("SKU-%04d", i)
		title := fmt.Sprintf("High-Performance Item %d", i)
		category := categories[rand.Intn(len(categories))]
		price := 19.99 + float64(rand.Intn(500))

		// 8-dimensional embedding vector
		vec := make([]float32, 8)
		for j := range vec {
			vec[j] = rand.Float32()*2 - 1
		}
		vecBlob := types.VectorToBytes(types.Normalize(vec))

		_, err := db.ExecContext(ctx, "INSERT INTO products (sku, title, category, price, stock, embedding) VALUES (?, ?, ?, ?, ?, ?)",
			sku, title, category, price, rand.Intn(100), vecBlob)
		if err != nil {
			log.Fatalf("insert product failed: %v", err)
		}
	}

	// Insert Orders
	statuses := []string{"pending", "processing", "shipped", "delivered", "cancelled"}
	for i := 1; i <= 150; i++ {
		userId := 1 + rand.Intn(60)
		status := statuses[rand.Intn(len(statuses))]
		amount := 25.0 + float64(rand.Intn(950))
		tracking := fmt.Sprintf("TRK-%06d", rand.Intn(999999))

		_, err := db.ExecContext(ctx, "INSERT INTO orders (user_id, status, total_amount, tracking_number) VALUES (?, ?, ?, ?)",
			userId, status, amount, tracking)
		if err != nil {
			log.Fatalf("insert order failed: %v", err)
		}
	}

	fmt.Println("✓ Successfully generated demo.db with users, products (vector embeddings), orders, audit_logs, views, and triggers.")
}
