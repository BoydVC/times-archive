#!/usr/bin/env bash
# (Re)build the index and start the Times Archive server on 127.0.0.1:4645 in the background.
cd "$(dirname "$0")"
[ "$1" = "--rebuild" ] && python3 build.py && python3 export_snapshot.py
if curl -s -m 2 http://127.0.0.1:4645/health | grep -q ok; then echo "already running on http://127.0.0.1:4645"; exit 0; fi
setsid nohup python3 server.py > data/server.log 2>&1 < /dev/null &
sleep 1; curl -s -m 2 http://127.0.0.1:4645/health >/dev/null && echo "running on http://127.0.0.1:4645"
