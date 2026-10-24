#!/usr/bin/env python3
"""Read-only production HTTP checks. Not a Googlebot/GSC simulation."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

ROOTS = [
    "https://everytinytool.com/",
    "https://image.everytinytool.com/",
    "https://random.everytinytool.com/",
    "https://calculate.everytinytool.com/",
    "https://pickacard.everytinytool.com/",
]
CANONICAL_PAIRS = [
    ("https://everytinytool.com/pdf-compressor/",
     "https://image.everytinytool.com/pdf-compressor/"),
    ("https://everytinytool.com/remove-background/",
     "https://image.everytinytool.com/remove-background/"),
]
EXTRAS = [
    "https://image.everytinytool.com/metadata-checker/",
    "https://image.everytinytool.com/metadata-inspector/",
    "https://readingroom.everytinytool.com/",
]
TARGETS = list(dict.fromkeys(
    ROOTS + [u for r in ROOTS for u in (urljoin(r, "robots.txt"), urljoin(r, "sitemap.xml"))]
    + [u for pair in CANONICAL_PAIRS for u in pair] + EXTRAS
))

class Head(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals = []
        self.robots = []
        self.h1_count = 0
        self.refresh = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "link" and "canonical" in a.get("rel", "").lower().split():
            self.canonicals.append(a.get("href", ""))
        if tag == "meta" and a.get("name", "").lower() in ("robots", "googlebot"):
            self.robots.append(a.get("content", ""))
        if tag == "meta" and a.get("http-equiv", "").lower() == "refresh":
            self.refresh = a.get("content")
        if tag == "h1":
            self.h1_count += 1

def probe(url):
    row = {"url": url}
    request = Request(url, headers={"User-Agent": "Mozilla/5.0 (compatible; ReadOnlySEODiagnostic/1.0)"})
    try:
        try:
            response = urlopen(request, timeout=12)
        except HTTPError as exc:
            response = exc
        with response:
            row["status"] = response.status
            row["final_url"] = response.url
            row["content_type"] = response.headers.get("Content-Type", "")
            row["x_robots_tag"] = response.headers.get("X-Robots-Tag", "")
            data = response.read(750000)
    except Exception as exc:
        row["transport_error"] = str(exc)
        return row
    body = data.decode("utf-8", "replace")
    if url.endswith("/sitemap.xml") and row.get("status") == 200:
        try:
            locs = [e.text for e in ET.fromstring(body).iter() if e.tag.endswith("}loc") or e.tag == "loc"]
            row["sitemap_urls"] = len(locs)
            row["sitemap_includes_root"] = urljoin(url, "/") in locs
            if "image.everytinytool.com" in url:
                row["sitemap_has_pdf"] = "https://image.everytinytool.com/pdf-compressor/" in locs
                row["sitemap_has_background"] = "https://image.everytinytool.com/remove-background/" in locs
        except ET.ParseError as exc:
            row["sitemap_error"] = str(exc)
    elif "text/html" in row.get("content_type", "").lower():
        doc = Head()
        doc.feed(body)
        row.update(canonical=doc.canonicals, robots_meta=doc.robots,
                   h1_count=doc.h1_count, meta_refresh=doc.refresh)
    elif url.endswith("/robots.txt"):
        row["robots_excerpt"] = body[:600]
    return row

def main():
    with ThreadPoolExecutor(max_workers=7) as pool:
        pending = {pool.submit(probe, u): u for u in TARGETS}
        by_url = {pending[fut]: fut.result() for fut in as_completed(pending)}
    rows = [by_url[u] for u in TARGETS]
    Path("live-seo-probe.json").write_text(
        json.dumps({"scope": "ordinary GET requests, NOT Googlebot or Search Console", "results": rows},
                   ensure_ascii=False, indent=2), encoding="utf-8")
    out = ["# Public HTTP SEO probe (read only)",
           "", "Ordinary HTTP GET, not a Googlebot test. Environment failures are not origin-site failures.",
           "", "| URL | Status | Final URL | Canonical | X-Robots-Tag / error |",
           "|---|---|---|---|---|"]
    for r in rows:
        can = ", ".join(r.get("canonical", []))
        error = (r.get("transport_error") or r.get("x_robots_tag") or "").replace("|", "/")
        out.append("| " + " | ".join(str(x).replace("|", "/") for x in
                   (r["url"], r.get("status", "?"), r.get("final_url", "—"), can or "—", error or "—")) + " |")
    out += ["", "## Cross-domain canonical target checks"]
    for origin, target in CANONICAL_PAIRS:
        a, b = by_url[origin], by_url[target]
        out.append("- " + origin + " -> " + target +
                   " : source status " + str(a.get("status", "?")) +
                   ", target status " + str(b.get("status", "?")) +
                   ", target canonical " + str(b.get("canonical", [])))
    out += ["", "## Sitemap counts"]
    for r in rows:
        if "sitemap.xml" in r["url"]:
            out.append("- " + r["url"] + " : status " +
                       str(r.get("status", "?")) + ", URLs " +
                       str(r.get("sitemap_urls", "?")))
    out += ["", "See live-seo-probe.json artifact for headers and metadata."]
    md = "\n".join(out) + "\n"
    Path("live-seo-probe.md").write_text(md, encoding="utf-8")
    print(md)
    import os
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as fh:
            fh.write(md)

if __name__ == "__main__":
    main()
