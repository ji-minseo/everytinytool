# GitHub Pages → Cloudflare Pages transition

## Confirmed old deployment
`.github/workflows/pages.yml` on `main` deploys the repository root to **GitHub Pages** on main pushes. This is **not** a Cloudflare Pages project. The new Cloudflare Pages project must be created separately.

## Create Cloudflare Pages staging first (do not change DNS)
1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Authorize repository `ji-minseo/everytinytool`.
3. Project name: `everytinytool-unified` (or another available name).
4. **Production branch:** `feature/image-everything-apex-migration-20261110` for initial safe staging on the Pages-managed `*.pages.dev` hostname. Do not select `main` until cutover is reviewed.
5. **Framework preset:** None.
6. **Build command:** `bash scripts/cloudflare-pages-build.sh`.
7. **Build output directory:** `dist`.
8. **Root directory:** repository root (leave blank).
9. Deploy. Check both Cloudflare build logs and the `*.pages.dev` URL.

The builder takes the reviewed pinned Image Everything guides branch plus Random and Calculate sources, validates all 95 pages, JS/CSS resources, sitemap, canonical tags, and static internal reachability. It does not change the existing GitHub Pages custom domain or DNS.

The generated `dist/_headers` sends `X-Robots-Tag: noindex` **only on Cloudflare `*.pages.dev` staging hostnames**; the apex domain remains indexable. Verify response headers on both environments. Cloudflare's automatic preview noindex does not automatically protect the project's main `*.pages.dev` hostname.

## Before custom domain
- Confirm the Cloudflare `*.pages.dev` site returns HTTP 200 for `/`, `/ko/`, `/compress-image/`, `/metadata-cleaner/`, `/random/`, `/calculate/`, and `/calculate/ko/`.
- Inspect actual CSS/JS loading, test mobile file processing, ZIP download, video compression and metadata cleaner.
- Verify the response has no `X-Robots-Tag: noindex` and no robots meta `noindex`; verify `robots.txt` and 95-entry `sitemap.xml`.
- Verify that no standalone paid product callback/webhook routes are hosted on the old GitHub Pages apex. Keep `pickacard`, `saju`, `readingroom` and unrelated subdomains unchanged.
- Inventory old apex routes and preserve real incoming indexed paths, including potentially retired tools, with real equivalent redirects when possible.
- **Back up existing Cloudflare DNS records**, verify domain active in Cloudflare and check currently attached GitHub Pages DNS A/AAAA/CNAME and any existing redirect rules.
- Do not delete the old DNS record until Cloudflare Pages custom-domain activation has been prepared and a rollback plan recorded.

## Cutover
1. Once pages.dev QA passes, prepare Pages → Custom domains → `everytinytool.com`; Cloudflare zone must be active. The account may configure the apex record when activating the domain. Review the change before completing it.
2. Change the Pages production branch to `main` **only after** merging the reviewed migration PR, or keep the dedicated migration branch until the exact cutover; do not point Pages at old `main` accidentally.
3. Check exact HTTP response/redirects and payment endpoints after attaching the domain. Check HTTP and HTTPS variants.
4. Configure host-aware permanent 301 redirects for `image.everytinytool.com/*` → `everytinytool.com/*`, `random.everytinytool.com/*` → `everytinytool.com/random/*`, and `calculate.everytinytool.com/*` → `everytinytool.com/calculate/*`; retain query string. Preserve original subdomain DNS while redirects are active. Test nontrivial deep paths and prevent loops.
5. Only when stable, disable the old GitHub Pages workflow in a separate reviewed change to `main`. Do **not** disable it before the custom domain is live and tested.
6. Submit `https://everytinytool.com/sitemap.xml` in Google Search Console; monitor 404s, indexing, redirects and search traffic.

## Rollback
- The original repository contents are retained in `backup/everytinytool-before-image-20261110`; the original GitHub Pages workflow remains live until after the switch.
- If the new apex breaks, restore previous DNS records / previous serving configuration according to the backed-up records, then verify functionality, DNS, and SSL. DNS propagation is not instantaneous.
- No automated production deploy, DNS modification, payment modification, or subdomain redirect is performed by this document or build script.

## Why the old CI checks currently fail
Legacy checks still expect removed root scripts (e.g. `assets/quick-image-studio.js`, `assets/tiny-workspace.js`). The new consolidated build uses source-specific JavaScript and its own successful integration CI. Do not suppress old checks without either retargeting them to active functions or explicitly retiring the legacy features after confirming their URL and usage impact.

## Production branch after migration — 2026-11-11

The unified migration PR #6 is merged into `main` (merge commit `2dbe6cca824f69c27d54ffb923de13e6e67a0562`). The user has switched the Cloudflare Git integration's production branch to `main`. This documentation-only commit is intended to trigger a new production build from `main`, with no DNS or site-code modification. Keep the Cloudflare build command `bash scripts/cloudflare-pages-build.sh` and output directory `dist`; check that the Cloudflare production deployment references this commit and reports Success. GitHub Pages automatic push deployment is disabled; its workflow remains available only as a manual rollback.

If the Cloudflare Git integration does not trigger on this commit, open the Cloudflare project Deployments tab and retry or create a production deployment from `main`; verify Git integration/webhook permissions. Never interpret a successful GitHub Actions check as confirmation of a Cloudflare production deployment.
