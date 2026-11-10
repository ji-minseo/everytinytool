#!/usr/bin/env python3
"""Enhance SEO metadata for the generated 95-page Every Tiny Tool site.

Run *after* unified assembly. Deterministic and idempotent; do not add
unsupported review/rating, FAQ eligibility, or fictitious modified dates.
"""
from __future__ import annotations

import argparse
from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

ORIGIN = "https://everytinytool.com"
NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
XHTML = "http://www.w3.org/1999/xhtml"
ET.register_namespace("", NS)
ET.register_namespace("xhtml", XHTML)

class HeadReader(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.description = ""
        self.canonical = []
        self.language = ""
        self._in_title = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.language = a.get("lang", "")
        elif tag == "title":
            self._in_title = True
        elif tag == "meta" and a.get("name", "").lower() == "description":
            self.description = a.get("content", "")
        elif tag == "link" and "canonical" in a.get("rel", "").lower().split():
            self.canonical.append(a.get("href", ""))

    def handle_data(self, data):
        if self._in_title:
            self.title += data

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False

def url_for_file(root: Path, file: Path) -> str:
    rel = file.parent.relative_to(root).as_posix()
    return ORIGIN + ("/" if rel == "." else "/" + rel + "/")

def alternate_languages(url: str, indexed: set[str]) -> dict[str, str]:
    path = url.removeprefix(ORIGIN)
    if path.startswith("/calculate/"):
        tail = path.removeprefix("/calculate/")
        if tail.startswith("ko/"):
            en = ORIGIN + "/calculate/" + tail[3:]
            ko = url
        else:
            en = url
            ko = ORIGIN + "/calculate/ko/" + tail
    elif path.startswith("/ko/"):
        en = ORIGIN + path.replace("/ko/", "/", 1)
        ko = url
    else:
        en = url
        ko = ORIGIN + "/ko" + path
    if en not in indexed or ko not in indexed or en == ko:
        return {}
    return {"en": en, "ko": ko, "x-default": en}

def meta_content(property_name: str, value: str, *, attr: str = "property") -> str:
    return f'<meta {attr}="{property_name}" content="{escape(value, quote=True)}">'

def enrich(root: Path) -> dict:
    sitemap = root / "sitemap.xml"
    xml = ET.parse(sitemap)
    sitemap_entries = xml.getroot().findall(f"{{{NS}}}url")
    indexed = {
        (entry.findtext(f"{{{NS}}}loc") or "").strip() for entry in sitemap_entries
    }
    if len(indexed) != 95 or len(sitemap_entries) != 95:
        raise ValueError(f"Expected exactly 95 unique sitemap URLs, got {len(indexed)}")
    page_files = sorted(root.rglob("index.html"))
    if len(page_files) != 95:
        raise ValueError(f"Expected 95 HTML pages, got {len(page_files)}")
    language_pairs = 0
    pages_updated = 0
    for file in page_files:
        url = url_for_file(root, file)
        if url not in indexed:
            raise ValueError(f"Unsitemapped page: {url}")
        doc = file.read_text("utf-8")
        reader = HeadReader()
        reader.feed(doc)
        if reader.canonical != [url]:
            raise ValueError(f"Canonical mismatch at {url}: {reader.canonical}")
        if reader.language not in ("en", "ko"):
            raise ValueError(f"Missing valid language for {url}")
        if not reader.title.strip() or not reader.description.strip():
            raise ValueError(f"Missing title/description for {url}")
        if doc.count("</head>") != 1:
            raise ValueError(f"Ambiguous head tag: {url}")
        # Remove old social tags and language alternates so there is exactly
        # one consistent set. Preserve all other metadata and existing FAQ/Article.
        doc = re.sub(
            r'<meta\s+(?:property="og:[^"]+"|name="twitter:[^"]+")[^>]*>\s*',
            "", doc, flags=re.I,
        )
        doc = re.sub(
            r'<link\s+rel="alternate"\s+hreflang="[^"]+"[^>]*>\s*',
            "", doc, flags=re.I,
        )
        alternates = alternate_languages(url, indexed)
        if alternates:
            language_pairs += 1
        locale = "ko_KR" if reader.language == "ko" else "en_US"
        tags = [
            meta_content("og:type", "website"),
            meta_content("og:site_name", "Every Tiny Tool"),
            meta_content("og:locale", locale),
            meta_content("og:url", url),
            meta_content("og:title", reader.title.strip()),
            meta_content("og:description", reader.description.strip()),
            meta_content("twitter:card", "summary", attr="name"),
            meta_content("twitter:title", reader.title.strip(), attr="name"),
            meta_content("twitter:description", reader.description.strip(), attr="name"),
        ]
        tags += [
            f'<link rel="alternate" hreflang="{lang}" href="{escape(dest, quote=True)}">'
            for lang, dest in alternates.items()
        ]
        # Structured data describes only verifiable site organization and
        # existing page hierarchy; do not fabricate ratings or reviews.
        if url in (ORIGIN + "/", ORIGIN + "/ko/"):
            schema = {
                "@context": "https://schema.org", "@type": "WebSite",
                "@id": ORIGIN + "/#website",
                "url": ORIGIN + "/", "name": "Every Tiny Tool",
                "inLanguage": reader.language,
                "description": reader.description.strip(),
            }
            tags.append(
                '<script type="application/ld+json">'
                + json.dumps(schema, ensure_ascii=False, separators=(",", ":"))
                .replace("<", "\\u003c") + '</script>'
            )
        # No fake breadcrumb categories: the top page and direct section
        # hierarchy only; every item must resolve to a real indexed page.
        path = url.removeprefix(ORIGIN)
        parts = [p for p in path.strip("/").split("/") if p]
        if len(parts) >= 2:
            crumbs = [{"@type": "ListItem", "position": 1,
                       "name": "Every Tiny Tool", "item": ORIGIN + "/"}]
            current = ""
            for segment in parts:
                current += "/" + segment
                dest = ORIGIN + current + "/"
                if dest not in indexed:
                    continue
                crumbs.append({
                    "@type": "ListItem", "position": len(crumbs) + 1,
                    "name": segment.replace("-", " ").title(),
                    "item": dest,
                })
            if len(crumbs) > 1 and crumbs[-1]["item"] == url:
                schema = {"@context": "https://schema.org",
                          "@type": "BreadcrumbList", "itemListElement": crumbs}
                tags.append(
                    '<script type="application/ld+json">'
                    + json.dumps(schema, ensure_ascii=False, separators=(",", ":"))
                    + '</script>'
                )
        doc = doc.replace("</head>", "\n" + "\n".join(tags) + "\n</head>", 1)
        file.write_text(doc, "utf-8")
        pages_updated += 1
    # Reciprocal sitemap language links mirror HTML hreflang and include
    # only actual canonical pages. Avoid invented alternate language pages.
    for entry in sitemap_entries:
        for tag in list(entry):
            if tag.tag == f"{{{XHTML}}}link":
                entry.remove(tag)
        url = (entry.findtext(f"{{{NS}}}loc") or "").strip()
        for lang, dest in alternate_languages(url, indexed).items():
            ET.SubElement(entry, f"{{{XHTML}}}link",
                          {"rel": "alternate", "hreflang": lang, "href": dest})
    xml.write(sitemap, encoding="utf-8", xml_declaration=True)
    return {"pages": pages_updated, "localized_pages": language_pairs,
            "sitemap_entries": len(sitemap_entries)}

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("root", type=Path)
    args = parser.parse_args()
    print(json.dumps(enrich(args.root.resolve()), ensure_ascii=False))
