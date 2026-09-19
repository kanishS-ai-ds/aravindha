#!/bin/bash
# Multi-mirror COOLR fetch with retry — runs until it succeeds or exhausts mirrors
OUT="ml-service/data/coolr_raw.csv"
URLS=(
  "https://maps.nccs.nasa.gov/downloadable/nasa_global_landslide_catalog_point.csv"
  "https://data.nasa.gov/api/views/tjff-iytn/rows.csv?accessType=DOWNLOAD"
  "https://catalog.data.gov/api/3/action/package_show?id=nasa-global-landslide-catalog-export"
)
for u in "${URLS[@]}"; do
  for try in 1 2 3 4 5; do
    curl -s -L --max-time 90 -o "$OUT.tmp" "$u"
    if head -c 400 "$OUT.tmp" | grep -qiE "source_link|event_id|event_date|latitude|result"; then
      if head -1 "$OUT.tmp" | grep -qi "latitude"; then
        mv "$OUT.tmp" "$OUT"; echo "OK from $u ($(wc -l < $OUT) lines)"; exit 0
      fi
      # JSON metadata response — extract dataset id for a follow-up
      echo "META: $u -> $(head -c 300 $OUT.tmp)"
    fi
    sleep 5
  done
done
echo "ALL_MIRRORS_FAILED"
exit 1
