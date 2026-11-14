"""Regenerates index.html, the manifest and the offline cache from tools/page.html.

Takes app/index.html (written for the Artifact viewer, which supplies the document
skeleton) and wraps it in a real HTML document, plus the bits that make it behave
like an app on an iPad home screen: a manifest, an icon, and an offline cache.
"""
import os, re, shutil, time, json

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = HERE  # the repo root is what GitHub Pages serves
MODULES = ["app.js", "state.js", "ui.js", "word.js", "lesson.js",
           "engine.js", "platform.js", "content.js", "stories.js"]
VERSION = time.strftime("%Y%m%d-%H%M%S")

page = open(os.path.join(HERE, "tools", "page.html")).read()
title = re.search(r"<title>(.*?)</title>", page).group(1)
# The viewer supplies these; a standalone document writes its own head instead.
body = re.sub(r"<title>.*?</title>\s*", "", page, count=1)
body = re.sub(r'<meta name="claude:viewport-fit-sides"[^>]*>\s*', "", body, count=1)

HEAD = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="Reading and spelling practice, one word at a time.">
<meta name="theme-color" content="#0F6E7E">
<link rel="manifest" href="manifest.webmanifest">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="{title}">
<link rel="apple-touch-icon" href="assets/icon-180.png">
<link rel="icon" type="image/png" sizes="512x512" href="assets/icon-512.png">
<style>
  /* The same base the Artifact viewer applies, so the app looks identical either way. */
  :root {{ color-scheme: light; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }}
  body {{ margin: 0; font: 14px system-ui, sans-serif; }}
  img {{ max-width: 100%; }}
  [hidden] {{ display: none !important; }}
  /* A child's app should not select text or bounce when she taps and drags. */
  body {{ -webkit-user-select: none; user-select: none; -webkit-tap-highlight-color: transparent; overscroll-behavior-y: contain; }}
  input, pre {{ -webkit-user-select: text; user-select: text; }}
</style>
</head>
<body>
"""

FOOT = """
<script>
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () { /* works online regardless */ });
    });
  }
</script>
</body>
</html>
"""

open(os.path.join(OUT, "index.html"), "w").write(HEAD + body + FOOT)

open(os.path.join(OUT, "manifest.webmanifest"), "w").write(json.dumps({
    "name": title,
    "short_name": title,
    "description": "Reading and spelling practice, one word at a time.",
    "start_url": "./",
    "scope": "./",
    "display": "standalone",
    "orientation": "portrait",
    "background_color": "#EEF2F4",
    "theme_color": "#0F6E7E",
    "icons": [
        {"src": "assets/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
        {"src": "assets/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
    ],
}, indent=2))

files = ["./", "./index.html", "./manifest.webmanifest"] + ["./" + m for m in MODULES] \
    + ["./assets/icon-180.png", "./assets/icon-192.png", "./assets/icon-512.png"]
open(os.path.join(OUT, "sw.js"), "w").write(
    '// Keeps the app working with no internet, so a lesson never depends on wifi.\n'
    'const CACHE = "word-by-word-%s";\n' % VERSION
    + 'const FILES = %s;\n\n' % json.dumps(files, indent=2)
    + """self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((hit) => {
      if (hit) return hit;
      return fetch(event.request).then((response) => {
        // Keep the fonts too, so the second opening works offline as well.
        if (response.ok && (response.type === "basic" || response.type === "cors")) {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy)).catch(() => {});
        }
        return response;
      });
    }).catch(() => caches.match("./index.html"))
  );
});
""")
print("built", OUT, "version", VERSION)
