#!/usr/bin/env bash
set -euo pipefail

# Vercel preview only. Pull all three public, reviewed revisions into a
# disposable build directory, never copy secrets or alter Cloudflare.
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

git clone --quiet https://github.com/ji-minseo/image-everything.git "$workdir/image"
git -C "$workdir/image" checkout --quiet --detach 8d21f13f29f475587e1368e97f08606d626fb4b6

git clone --quiet https://github.com/ji-minseo/random-everything.git "$workdir/random"
git -C "$workdir/random" checkout --quiet --detach b4f2fac44be2d56a8e30a83da37de12cdb50d7f8

git clone --quiet https://github.com/ji-minseo/calculate-everything.git "$workdir/calculate"
git -C "$workdir/calculate" checkout --quiet --detach 3c5d47cd7d0e333a2aeef133308e87591f38860e

python3 scripts/build_unified_everytinytool.py \
  --image-source "$workdir/image" \
  --random-source "$workdir/random" \
  --calculate-source "$workdir/calculate" \
  --target "$PWD" \
  --stage "$workdir/preview-build"

cp -a "$workdir/preview-build" "$PWD/dist"

test -f dist/index.html
test -f dist/random/index.html
test -f dist/calculate/index.html
test -f dist/ko/guides/index.html
printf 'Generated unified Every Tiny Tool preview with 95 verified pages.\n'
