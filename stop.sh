#!/usr/bin/env bash
# Stop only the process listening on 127.0.0.1:4645 (leaves other TokenMax servers alone).
pid=$(ss -ltnpH 'sport = :4645' | grep -o 'pid=[0-9]*' | cut -d= -f2 | head -1)
[ -n "$pid" ] && kill "$pid" && echo "stopped $pid" || echo "not running"
