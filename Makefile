.PHONY: all build build-ui build-go dev test clean

BINARY_NAME=litelens
BIN_DIR=bin

all: build

build-ui:
	cd ui && npm install && npm run build

build-go:
	go build -ldflags="-s -w" -o $(BIN_DIR)/$(BINARY_NAME) main.go

build: build-ui build-go

dev-ui:
	cd ui && npm run dev

dev-go:
	go run main.go --no-browser

test:
	go test -v ./...

clean:
	rm -rf $(BIN_DIR) ui/dist
