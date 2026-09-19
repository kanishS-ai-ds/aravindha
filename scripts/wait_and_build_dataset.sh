#!/bin/bash
# ARAVINDHA — wait for Open-Meteo archive hourly quota reset, then build dataset.
# Probes every 5 min (max ~3.3 h), then execs the builder so it completes unattended.
cd "$(dirname "$0")/.."

PROBE_URL="https://archive-api.open-meteo.com/v1/archive?latitude=25.3&longitude=91.6&start_date=2009-01-01&end_date=2009-01-05&daily=precipitation_sum&timezone=UTC"

for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$PROBE_URL")
  echo "[$(date +%H:%M:%S)] probe=$code"
  if [ "$code" = "200" ]; then
    echo "quota reset — launching dataset build"
    exec python scripts/build_landslide_dataset.py
  fi
  sleep 300
done
echo "gave up waiting for quota reset"
exit 1
