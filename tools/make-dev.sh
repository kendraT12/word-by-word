#!/bin/sh
# Builds a fresh, uncached copy of the app for local testing: index.html wrapped in the
# same skeleton the Artifact viewer adds, in a new directory so nothing is served stale.
TS=$(date +%s)
OUT=".devbuild/$TS"
rm -rf .devbuild
mkdir -p "$OUT"
cp app.js state.js ui.js word.js lesson.js engine.js platform.js content.js stories.js "$OUT/"
{
  printf '<!doctype html><html><head><meta charset="utf8">'
  printf '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">'
  printf '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%%}[hidden]{display:none!important}</style>'
  printf '</head><body>'
  cat index.html
  printf '</body></html>'
} > "$OUT/index.html"
echo "http://localhost:8765/$OUT/"
