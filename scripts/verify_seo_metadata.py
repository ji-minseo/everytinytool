#!/usr/bin/env python3
"""Verify deployed HTML metadata, reciprocal locales and XML sitemap for 95 pages."""
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parent))
from enrich_unified_seo import ORIGIN, NS, XHTML, alternate_languages, url_for_file

class Metadata(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.meta = []
        self.lang = None
        self.title_count = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html": self.lang = a.get("lang")
        if tag == "link": self.links.append(a)
        if tag == "meta": self.meta.append(a)
        if tag == "title": self.title_count += 1

    def meta_values(self, key, attr):
        return [a.get("content") for a in self.meta if a.get(attr) == key]

    def links_by_rel(self, rel):
        return [a for a in self.links if rel in a.get("rel", "").split()]

def verify(root: Path) -> None:
    xml = ET.parse(root / "sitemap.xml")
    entries = xml.getroot().findall(f"{{{NS}}}url")
    urls = [(e.findtext(f"{{{NS}}}loc") or "").strip() for e in entries]
    assert len(urls) == len(set(urls)) == 95, "invalid sitemap count"
    canonical_set = set(urls)
    checked = set()
    for file in sorted(root.rglob("index.html")):
        url = url_for_file(root, file)
        p = Metadata(); p.feed(file.read_text("utf-8"))
        assert url in canonical_set, f"page not sitemapped: {url}"
        assert p.lang in ("en", "ko"), f"language missing: {url}"
        assert p.title_count == 1, f"title count != 1: {url}"
        assert [a.get("href") for a in p.links_by_rel("canonical")] == [url], f"canonical: {url}"
        assert len(p.meta_values("description", "name")) == 1, f"description: {url}"
        expected = {
            "og:type": "website",
            "og:site_name": "Every Tiny Tool",
            "og:url": url,
            "og:locale": "ko_KR" if p.lang == "ko" else "en_US",
        }
        for key, value in expected.items():
            assert p.meta_values(key, "property") == [value], f"{key}: {url}"
        for key in ("og:title", "og:description"):
            assert len(p.meta_values(key, "property")) == 1, f"{key}: {url}"
        for key in ("twitter:card", "twitter:title", "twitter:description"):
            assert len(p.meta_values(key, "name")) == 1, f"{key}: {url}"
        expected_alternates = alternate_languages(url, canonical_set)
        actual = {a.get("hreflang"): a.get("href") for a in p.links_by_rel("alternate") if a.get("hreflang")}
        assert actual == expected_alternates, f"hreflang mismatch at {url}: {actual} vs {expected_alternates}"
        checked.add(url)
    assert checked == canonical_set, "sitemap and HTML mismatch"
    for entry in entries:
        url = (entry.findtext(f"{{{NS}}}loc") or "").strip()
        expected = alternate_languages(url, canonical_set)
        actual = {
            a.attrib.get("hreflang"): a.attrib.get("href")
            for a in entry.findall(f"{{{XHTML}}}link")
        }
        assert actual == expected, f"XML language alternates mismatch at {url}"
        for lang, target in expected.items():
            reverse = alternate_languages(target, canonical_set)
            assert reverse.get(lang) == target, f"non-reciprocal href: {url}"
    print(f"SEO metadata verified: {len(checked)} pages, 95 sitemap entries, canonical/social/hreflang intact.")

if __name__ == "__main__":
    verify(Path(sys.argv[1]).resolve())
