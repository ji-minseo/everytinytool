#!/usr/bin/env bash
set -euo pipefail

# Cloudflare Pages build. No DNS or production changes are made here.
# Reuse the pinned three-repository staging generator also used by Vercel preview.
bash scripts/vercel-preview-build.sh

# Add stable social tags, site identity and reciprocal language alternates.
python3 scripts/enrich_unified_seo.py dist

# Protect Cloudflare Pages staging hostnames from indexing without blocking
# the eventual canonical everytinytool.com custom domain.
cat > dist/_headers <<'HEADERS'
https://:project.pages.dev/*
  X-Robots-Tag: noindex

https://:version.:project.pages.dev/*
  X-Robots-Tag: noindex
HEADERS

test -f dist/index.html
test -f dist/random/index.html
test -f dist/calculate/index.html
test -f dist/calculate/ko/index.html
test -f dist/ko/guides/index.html
test -f dist/_redirects
test -f dist/robots.txt
test -f dist/sitemap.xml

python3 scripts/verify_unified_resources.py dist
python3 - <<'PY'
from pathlib import Path
import sys
sys.path.insert(0, str(Path("scripts").resolve()))
from seo_audit import local_audit
report = local_audit(Path("dist"))
print("Cloudflare Pages SEO:", {k: report[k] for k in ("page_count", "sitemap_count", "reachable_count")})
if report["errors"]:
    for item in report["errors"][:20]:
        print(item, file=sys.stderr)
    raise SystemExit("Cloudflare Pages SEO check failed")
assert report["page_count"] == report["sitemap_count"] == report["reachable_count"] == 95
# Vercel's preview-only noindex header is configured via vercel.json,
# which is not part of the Cloudflare Pages output.
assert not (Path("dist") / "vercel.json").exists()
print("Cloudflare Pages build is ready for a pages.dev staging deployment.")
PY
