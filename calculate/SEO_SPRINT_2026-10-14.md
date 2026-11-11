# Organic search sprint — 2026-10-14

## Scope and source

Google Search Console exports provided 2026-10-14 for the **everytinytool.com domain property**:
- Last 7 days export: 2026-10-05 through 2026-10-11.
- "Last 3 months" export: actual available daily data begins 2026-09-26 and ends 2026-10-11.

**These exports overlap. Do not add their totals or treat them as two independent periods.** Search Console average position is an aggregate, not a fixed page number. Query and Page tables are grouped independently; query→URL attribution must be checked in Search Console with a page filter.

### Impressions and clicks

| Complete period | Days | Impressions | Average/day | Clicks |
|---|---:|---:|---:|---:|
| Oct 1–4 | 4 | 522 | 130.5 | 0 |
| Oct 5–11 | 7 | 1,186 | 169.4 | 5 |

Daily impression rate increased around 29.8% across unequal-sized but nonoverlapping windows. The first period is only 4 days, and the overall site is too new for robust statistical conclusions. Clicking traffic is still low.

### Landing pages — Oct 5–11

| URL | Impressions | Clicks | Average position | Priority |
|---|---:|---:|---:|---|
| /ratio-calculator/ | 217 | 0 | 16.84 | P1: near page two |
| /tip-calculator/ | 48 | 0 | 10.50 | P1: high position but low clicks |
| /time-calculator/ | 206 | 0 | 24.42 | P2: track more query-by-page detail |
| image /jpg-compressor/ | 191 | 0 | 70.18 | P3: highly competitive, low current rank |
| image /png-compressor/ | 123 | 0 | 82.38 | P3 |

Selected query rows from these exports:
- "ratio calculator" — 114 impressions / 0 clicks / average position 15.11 **in the last 7 days**, and 200 impressions / average position 15.92 in the cumulative export.
- "tip calculator" — 23 impressions / 0 clicks / average position 9.65 in the cumulative export.
- "how to calculate tip" — 11 impressions / 0 clicks / average position 9.09 in the cumulative export.

Position values are averages across searches and are not promises of which search results page a user sees.

## Changes applied on 2026-10-14 (GitHub main)

1. `tip-calculator/index.html`:
   - More descriptive title/meta description and clear H1.
   - Substantial task-focused worked examples (15%, 20%, splitting bill, rounded shares).
   - Six helpful answers to specific common questions (including how to calculate tip).
   - Related links to Percentage Calculator and Ratio Calculator.
   - Interactive 10%, 15%, 18%, 20%, 25% quick preset buttons.
2. `ratio-calculator/index.html`:
   - Refined search summary and accurate worked examples for decimals, splitting totals and missing values.
   - Useful contextual links to Tip and Percentage tools.
3. `assets/tools.js`, `assets/styles.css`:
   - Tip presets update numeric input, pressed state and calculation.
   - Responsive button styling and visibly descriptive internal links.

Source-level checks: JavaScript syntax valid, preset clicks 15% and 18% recalculate expected amounts, editing a custom percent deselects presets, unique HTML element IDs, and expected metadata/links. **No live-browser or Google crawl/rank verification was performed.**

## Measurement plan

- In Search Console, filter by the exact page URL then inspect the **Queries** tab (don't infer a URL from independent query totals).
- Compare complete 7-day Mon–Sun windows of the same length: **Oct 5–11 (baseline)** vs **Oct 19–25**, then use 28-day views once more time has elapsed.
- Keep Search type = Web and match country/device when comparing positions or CTR. Focus first on relevant US English queries as well as all-country reporting.
- For ratio: monitor impressions/clicks/average position for "ratio calculator" and ratio simplifier variants.
- For tip: monitor "tip calculator", "how to calculate tip", "tip calculator free"; clicks/CTR are especially important if avg position stays near 10.
- A rise or fall in overall mean position can be driven by newly discovered queries rather than genuine rank movement for existing queries.
- Do not assume SEO changes cause immediate improvement or guarantee a top-10 position; ranking, competitive signals and indexing take time.

## Next technical/UX checks

- Inspect URL indexing and rendered pages in Search Console URL Inspection for /ratio-calculator/ and /tip-calculator/. Request reindexing once after publishing if needed. Google recrawl can take days or weeks.
- Test live calculator interactions on mobile and desktop, including conversion and keyboard flows.
- Check actual SERPs per country, especially relevant US queries, and inspect competitors' unique functional value rather than stuffing more repeated text.
- Seek natural references/links by distributing genuinely useful tool examples; do not buy links or build keyword-doorway pages.
- Prioritize first-page-adjacent tools over rebuilding distant-ranking JPG/PNG pages based only on their impression totals.

Google guidance:
- https://developers.google.com/search/docs/fundamentals/creating-helpful-content
- https://developers.google.com/search/docs/fundamentals/seo-starter-guide
- https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl
- https://support.google.com/webmasters/answer/7042828
