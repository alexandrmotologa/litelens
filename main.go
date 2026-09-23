package main

import (
	"embed"
	"io/fs"

	"github.com/alexandrmotologa/litelens/cmd"
	"github.com/alexandrmotologa/litelens/server"
)

//go:embed all:ui/dist
var embeddedFS embed.FS

func main() {
	if sub, err := fs.Sub(embeddedFS, "ui/dist"); err == nil {
		server.StaticAssets = sub
	}
	cmd.Execute()
}
