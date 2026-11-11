#!/usr/bin/env python3
"""Check CSS/JS resource paths after static sections are nested under /random/ and /calculate/."""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


class ResourceParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs: list[tuple[str, str]] = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "link" and attrs.get("rel", "").lower() == "stylesheet" and "href" in attrs:
            self.refs.append(("stylesheet", attrs["href"]))
        if tag == "script" and "src" in attrs:
            self.refs.append(("script", attrs["src"]))


def check(root: Path) -> None:
    errors: list[str] = []
    html_pages = list(root.rglob("index.html"))
    if len(html_pages) < 95:
        errors.append(f"Expected at least 95 HTML pages, found {len(html_pages)}")

    checked = 0
    for page in html_pages:
        parser = ResourceParser()
        parser.feed(page.read_text(encoding="utf-8"))
        for kind, ref in parser.refs:
            parts = urlsplit(ref)
            if parts.scheme or parts.netloc or ref.startswith("//"):
                continue
            if not parts.path or not parts.path.lower().endswith((".css", ".js")):
                continue
            decoded = unquote(parts.path)
            asset = (root / decoded.lstrip("/")) if decoded.startswith("/") else (page.parent / decoded)
            if not asset.resolve().is_relative_to(root.resolve()):
                errors.append(f"{page.relative_to(root)}: resource outside site: {ref}")
                continue
            if not asset.is_file():
                errors.append(f"{page.relative_to(root)}: missing {kind} {ref}")
            checked += 1
    if checked < 95:
        errors.append(f"Expected at least 95 local stylesheet/script refs; found {checked}")
    if errors:
        raise SystemExit("Resource verification failed:\n" + "\n".join(errors[:100]))
    print(f"Verified {checked} local CSS/JS references across {len(html_pages)} HTML pages.")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("site", type=Path, help="Generated site directory")
    check(p.parse_args().site.resolve())
