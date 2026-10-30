#!/usr/bin/env bash
# Capture 1440x900 screenshots of each view from the running server.
set -e
cd "$(dirname "$0")"
URL=${URL:-http://127.0.0.1:4645}
mkdir -p screenshots
shot(){ google-chrome --headless=new --no-sandbox --disable-gpu --hide-scrollbars --window-size=1440,900 --virtual-time-budget=${3:-4000} --screenshot="screenshots/$1.png" "$URL/$2" >/dev/null 2>&1; echo "screenshots/$1.png"; }
shot 01-front-page "#/"
shot 02-newsstand "#/wall"
shot 03-reader "#/read/030/1"
shot 04-reader-text-search "#/read/019/3?q=Marty"
shot 05-search "#/search?q=Kid School"
shot 06-trends "#/trends"
shot 07-print-log "#/timeline"
shot 08-sources "#/about"
