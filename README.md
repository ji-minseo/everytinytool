# Every Tiny Tool

A unified collection of free, focused browser-based tools, built around one public site: **https://everytinytool.com/**.

## Unified site

- **Image, PDF, video & metadata**: `/`, `/compress-image/`, `/remove-background/`, `/metadata-cleaner/`, and 18 practical guide articles (including Korean hub).
- **Random tools**: `/random/`, `/random/wheel-decider/`, `/random/pictionary-word-generator/` and eight other pages.
- **Calculators**: `/calculate/`, `/calculate/age-calculator/`, `/calculate/ko/` and related Korean calculator pages.

**95 distinct canonical URLs** from three original sites, with one main site identity. Some legacy metadata links are served as redirects and intentionally excluded from the sitemap.

## Source revisions

- **Image tools and guides**: `ji-minseo/image-everything`, commit `8d21f13f29f475587e1368e97f08606d626fb4b6` on `feature/guides-migration-20261031` (**NOT its main branch**).
- **Random**: `ji-minseo/random-everything`, pinned commit `b4f2fac44be2d56a8e30a83da37de12cdb50d7f8`.
- **Calculate**: `ji-minseo/calculate-everything`, pinned commit `3c5d47cd7d0e333a2aeef133308e87591f38860e`.

## Branches and release

The current consolidated site is prepared on `feature/image-everything-apex-migration-20261110` (Draft PR #6), not the production `main` branch. The original main is preserved at `backup/everytinytool-before-image-20261110`.

`scripts/build_unified_everytinytool.py` merges all sources, rewrites internal addresses to the apex domain, updates navigation and validates 95 canonical URLs. `scripts/vercel-preview-build.sh` builds a read-only Vercel preview with `X-Robots-Tag: noindex`. See [cutover plan](docs/image-apex-cutover.md).

**Do not merge or redirect the old subdomains until Cloudflare Pages/Workers routes, payment/webhook endpoints, and user-facing behavior have been checked.** The standalone `pickacard`, `saju`, and other payment-related services are not part of this migration.
