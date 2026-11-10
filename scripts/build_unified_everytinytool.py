#!/usr/bin/env python3
"""Stage Every Tiny Tool as one domain: image tools at /, Random at /random/,
and Calculate at /calculate/. No production deployment is performed.

Production replacement requires explicitly passing --apply on the release
branch after reviewing a --stage build and checking Cloudflare/payment routes.
"""
from __future__ import annotations

import argparse
from html import escape
from pathlib import Path
import re
import shutil
import tempfile
import xml.etree.ElementTree as ET

APEX = "https://everytinytool.com"
SOURCES = {
    "image": ("https://image.everytinytool.com", "", 64),
    "random": ("https://random.everytinytool.com", "/random", 11),
    "calculate": ("https://calculate.everytinytool.com", "/calculate", 20),
}
EXPECTED_PAGES = sum(item[2] for item in SOURCES.values())
TEXT_TYPES = {".html", ".css", ".js", ".json", ".xml", ".txt", ".svg", ".webmanifest", ".md"}
EXCLUDE_SOURCE = {
    ".git", ".github", ".vercel", ".devcontainer", ".DS_Store", ".gitignore",
    "node_modules", "coverage", "dist", "build", "docs", "scripts", "tests",
    "README.md", "LICENSE", "package.json", "package-lock.json",
    "pnpm-lock.yaml", "yarn.lock", "wrangler.toml", "wrangler.json",
    "wrangler.jsonc", "_redirects", "_headers", "_routes.json",
    "functions", "api", "_worker.js", ".well-known",
}
PROTECT_TARGET = {
    ".git", ".github", ".gitignore", ".well-known", ".devcontainer",
    "functions", "api", "_worker.js", "_routes.json", "_headers",
    "wrangler.toml", "wrangler.json", "wrangler.jsonc",
    "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
    "README.md", "LICENSE", "scripts", "docs", "tests",
}
# Prefer editing image URLs in place; preserves the original indexed paths and
# avoids unnecessary redirects when the apex switches away from the old hub.

def read_sitemap(source: Path, expected_origin: str, expected_count: int) -> list[str]:
    sitemap_file = source / "sitemap.xml"
    if not sitemap_file.exists():
        raise RuntimeError(f"Missing sitemap in {source}")
    root = ET.fromstring(sitemap_file.read_bytes())
    urls = [
        (node.text or "").strip()
        for node in root.findall(".//{http://www.sitemaps.org/schemas/sitemap/0.9}loc")
    ]
    if len(urls) != expected_count or len(set(urls)) != expected_count:
        raise RuntimeError(
            f"{source}: expected {expected_count} unique sitemap URLs; got {len(urls)}"
        )
    if any(not (u == expected_origin + "/" or u.startswith(expected_origin + "/")) for u in urls):
        raise RuntimeError(f"{source}: sitemap contains a foreign origin.")
    return urls

def copy_static(source: Path, destination: Path) -> None:
    if not (source / "index.html").exists():
        raise RuntimeError(f"No site index: {source}")
    if destination.exists():
        raise RuntimeError(f"Refusing to overwrite {destination}")
    destination.mkdir(parents=True)
    for item in source.iterdir():
        if item.name in EXCLUDE_SOURCE or item.name.startswith("."):
            continue
        if item.is_symlink():
            raise RuntimeError(f"Symlink in source: {item}")
        dest = destination / item.name
        if item.is_dir():
            shutil.copytree(item, dest, symlinks=False)
        else:
            shutil.copy2(item, dest)

def replace_origins(text: str) -> str:
    # Longer, specific source origins must be substituted before any generic
    # mention of the apex. Do not touch unrelated subdomain products.
    for name, (origin, prefix, _) in SOURCES.items():
        text = text.replace(origin, APEX + prefix)
    return text

def update_text_files(root: Path) -> None:
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in TEXT_TYPES:
            continue
        data = path.read_text("utf-8")
        new_data = replace_origins(data)
        if new_data != data:
            path.write_text(new_data, "utf-8")

def brand_image_site(root: Path) -> None:
    """Only rebrand image site's own HTML, never random/calculate HTML."""
    for path in root.rglob("*.html"):
        if path.relative_to(root).parts[0] in {"random", "calculate"}:
            continue
        text = path.read_text("utf-8")
        text = text.replace("Image Everything", "Every Tiny Tool")
        text = text.replace("IMAGE EVERYTHING", "EVERY TINY TOOL")
        text = text.replace("imageeverything.", "everytinytool.")
        text = text.replace("image<span>everything.</span>", "every<span>tinytool.</span>")
        # Existing three-link nav is retained, then add section navigation.
        ko = bool(re.search(r'<html[^>]*lang="ko"', text))
        random_label = "랜덤" if ko else "Random"
        calc_label = "계산기" if ko else "Calculate"
        menu = (
            f'<a href="/random/">{random_label}</a>'
            f'<a href="/calculate/">{calc_label}</a>'
        )
        if '<nav class="site-nav"' in text:
            text, changed = re.subn(
                r'(<nav class="site-nav"[^>]*>)([\s\S]*?)(</nav>)',
                lambda m: m.group(1) + m.group(2) + menu + m.group(3),
                text,
                count=1,
            )
            if changed != 1:
                raise RuntimeError(f"Could not extend site navigation: {path}")
        # Allow all five primary navigation links to remain accessible on narrow screens.
        responsive = ('<style id="ett-image-nav-responsive">'
                      'body .topbar.site-header .site-nav{gap:clamp(10px,1.8vw,24px)}'
                      '@media(max-width:760px){body .topbar.site-header .site-nav{'
                      'flex-wrap:wrap;gap:4px 19px}}'
                      '@media(max-width:380px){body .topbar.site-header .site-nav{gap:3px 12px}}'
                      '</style>')
        text = text.replace("</head>", responsive + "</head>", 1)
        path.write_text(text, "utf-8")

def add_cross_navigation(root: Path) -> None:
    css = (
        '<style id="ett-network-nav-style">'
        '.ett-network-nav{display:flex;flex-wrap:wrap;gap:8px;align-items:center;'
        'margin:0 0 14px;padding:11px 0;border-bottom:1px solid #e4ebf5;'
        'font:700 13px/1.5 Inter,ui-sans-serif,system-ui,sans-serif}'
        '.ett-network-nav a{color:#244ae5;text-decoration:none;padding:9px 12px;'
        'border-radius:10px;background:#eef3ff;white-space:nowrap}'
        '.ett-network-nav a[aria-current="page"]{background:#244ae5;color:#fff}'
        '.ett-network-nav a:hover{filter:brightness(.96)}'
        '</style>'
    )
    for section in ("random", "calculate"):
        sub = root / section
        for page in sub.rglob("*.html"):
            text = page.read_text("utf-8")
            if "</head>" not in text or "<body" not in text:
                raise RuntimeError(f"Cannot add network nav to {page}")
            text = text.replace("</head>", css + "</head>", 1)
            active = ' aria-current="page"'
            nav = (
                '<nav class="ett-network-nav" aria-label="Every Tiny Tool sections">'
                '<a href="/">Every Tiny Tool</a>'
                '<a href="/compress-image/">Image</a>'
                f'<a href="/random/"{active if section == "random" else ""}>Random</a>'
                f'<a href="/calculate/"{active if section == "calculate" else ""}>Calculate</a>'
                '</nav>'
            )
            header = re.search(r'<header\b[\s\S]*?</header>', text)
            if header:
                text = text[:header.end()] + nav + text[header.end():]
            else:
                text = re.sub(r'(<body[^>]*>)', r'\1' + nav, text, count=1)
            # Make the umbrella brand visible while preserving the subject title.
            if section == "random":
                text = text.replace(
                    'Random <span>Everything ✦</span>',
                    'Every <span>Tiny Tool</span> · Random'
                )
            else:
                text = text.replace(
                    'Calculate <span>Everything ✦</span>',
                    'Every <span>Tiny Tool</span> · Calculate'
                )
            page.write_text(text, "utf-8")

def home_sections(root: Path) -> None:
    css = (
        '<style id="ett-home-categories">'
        '.ett-category-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));'
        'gap:16px;margin:36px 0 45px}.ett-category-grid a{display:flex;flex-direction:column;'
        'gap:8px;padding:24px;border:1px solid #dfe8fa;border-radius:20px;'
        'background:#f7faff;text-decoration:none;color:#18223a;transition:transform .2s,border-color .2s}'
        '.ett-category-grid a:hover{transform:translateY(-3px);border-color:#315bff}'
        '.ett-category-grid b{font-size:19px}.ett-category-grid span{font-size:13px;line-height:1.6;color:#596a80}'
        '.ett-category-grid em{font-style:normal;font-size:13px;font-weight:800;color:#244ae5;margin-top:auto}'
        '@media(max-width:700px){.ett-category-grid{grid-template-columns:1fr;margin:23px 0}}'
        '</style>'
    )
    for relative, ko in (("index.html", False), ("ko/index.html", True)):
        path = root / relative
        html = path.read_text("utf-8").replace("</head>", css + "</head>", 1)
        page_title = ("무료 이미지·PDF·영상·랜덤·계산기 도구 | Every Tiny Tool" if ko
                      else "Every Tiny Tool | Free Image, Random & Calculator Tools")
        page_desc = ("이미지 편집·압축·변환, PDF·동영상, 랜덤 뽑기와 계산기를 한곳에서 무료로 사용하세요." if ko
                     else "Free browser tools for images, PDF, video, random choices and everyday calculations, all in one place.")
        html = re.sub(r"<title>[^<]*</title>", "<title>" + page_title + "</title>", html, count=1)
        html = re.sub(r'<meta name="description" content="[^"]*">',
                      '<meta name="description" content="' + page_desc + '">', html, count=1)
        if ko:
            new_heading = "작은 도구를 한곳에서.<br><em>이미지부터 계산까지.</em>"
            new_description = "이미지·PDF·동영상 작업부터 랜덤 선택, 일상 계산까지. 필요한 도구를 빠르게 찾아 바로 사용하세요."
            labels = [
                ("이미지·파일", "이미지 편집, PDF·동영상, 메타데이터를 처리하는 17개 도구", "이미지 도구 보기", "../compress-image/"),
                ("랜덤", "룰렛, 팀 나누기, 랜덤 숫자·단어 등 10개 도구", "랜덤 도구 보기", "/random/"),
                ("계산기", "비율·할인·날짜·시간·나이 등 생활 계산기", "계산기 보기", "/calculate/"),
            ]
        else:
            new_heading = "All the tiny tools.<br><em>One simple place.</em>"
            new_description = "Images, PDFs, videos, random choices, and everyday calculations. Find the tool you need and get straight to work."
            labels = [
                ("Image & Files", "17 tools for images, PDFs, video, and metadata", "Explore image tools", "./compress-image/"),
                ("Random", "10 quick tools for choices, games, teams, and words", "Explore random tools", "/random/"),
                ("Calculate", "Calculators for dates, money, ratios, and more", "Explore calculators", "/calculate/"),
            ]
        cards = "".join(
            f'<a href="{href}"><b>{escape(title)}</b><span>{escape(desc)}</span>'
            f'<em>{escape(action)} ↗</em></a>'
            for title, desc, action, href in labels
        )
        html = re.sub(
            r'(<h1 id="relaunch-title">)[\s\S]*?(</h1>)',
            lambda m: m.group(1) + new_heading + m.group(2),
            html,
            count=1,
        )
        # Only replace the original hero introduction, not the whole page.
        html, count = re.subn(
            r'(<div class="relaunch-hero-copy">[\s\S]*?</h1>\s*<p>)[\s\S]*?(</p>)',
            lambda m: m.group(1) + new_description + m.group(2),
            html,
            count=1,
        )
        if count != 1:
            raise RuntimeError(f"Homepage hero not found: {path}")
        # Add category grid to the end of the image hero before the tool list.
        insertion = (
            '<section class="home-section" aria-label="Tool categories" id="ett-categories">'
            f'<div class="ett-category-grid">{cards}</div></section>'
        )
        if '<section class="home-explainer"' not in html:
            raise RuntimeError(f"Main homepage structure differs: {path}")
        html = html.replace('<section class="home-explainer"', insertion + '\n<section class="home-explainer"', 1)
        path.write_text(html, "utf-8")

def create_sitemap(root: Path, urls: list[str]) -> None:
    if len(urls) != EXPECTED_PAGES or len(set(urls)) != EXPECTED_PAGES:
        raise RuntimeError(f"Expected {EXPECTED_PAGES} distinct URLs, got {len(urls)}.")
    sitemap = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f'  <url><loc>{escape(url)}</loc></url>\n' for url in urls)
        + '</urlset>\n'
    )
    (root / "sitemap.xml").write_text(sitemap, "utf-8")
    (root / "robots.txt").write_text(
        "User-agent: *\nAllow: /\n\nSitemap: https://everytinytool.com/sitemap.xml\n",
        "utf-8",
    )
    (root / "_redirects").write_text(
        "# Only old apex paths with a genuine equivalent are redirected.\n"
        "/quick-image-studio/ /compress-image/ 301\n"
        "/video-studio/ /video-compressor/ 301\n"
        "# Subdomain redirects require Cloudflare zone rules for each old HOST.\n",
        "utf-8",
    )

def validate_site(root: Path, urls: list[str]) -> None:
    pages = sorted(root.rglob("index.html"))
    if len(pages) != EXPECTED_PAGES:
        found = {APEX + ("/" if str(p.parent.relative_to(root)) == "." else "/" + p.parent.relative_to(root).as_posix() + "/") for p in pages}
        missing = sorted(set(urls) - found)
        extra = sorted(found - set(urls))
        raise RuntimeError(f"Expected {EXPECTED_PAGES} index pages; found {len(pages)}. Extra: {extra}; Missing: {missing}")
    urls_set = set(urls)
    for file in pages:
        relative = file.parent.relative_to(root)
        path = "/" if str(relative) == "." else "/" + relative.as_posix() + "/"
        url = APEX + path
        body = file.read_text("utf-8")
        if url not in urls_set:
            raise RuntimeError(f"Missing sitemap URL for {file}: {url}")
        if f'<link rel="canonical" href="{url}">' not in body:
            raise RuntimeError(f"Canonical is missing or wrong in {file}: {url}")
        for origin, _, _ in SOURCES.values():
            if origin in body:
                raise RuntimeError(f"Old site origin remains in {file}: {origin}")
        if 'href="/random/"' not in body or 'href="/calculate/"' not in body:
            raise RuntimeError(f"Cross-network navigation missing: {file}")
    for required in (
        "assets/tools.js", "assets/site-chrome.css", "ko/guides/index.html",
        "guides/index.html", "metadata-cleaner/index.html",
        "random/assets/styles.css", "random/wheel-decider/index.html",
        "calculate/assets/styles.css", "calculate/ko/index.html",
    ):
        if not (root / required).is_file():
            raise RuntimeError(f"Missing critical file: {required}")
    sitemap = (root / "sitemap.xml").read_text("utf-8")
    if sitemap.count("<loc>") != EXPECTED_PAGES:
        raise RuntimeError("Generated sitemap count mismatch.")
    print(f"Validated {len(pages)} pages, {len(urls)} URLs, 3 integrated sections.")

def assemble(root: Path, image: Path, random: Path, calculate: Path) -> None:
    inputs = {"image": image, "random": random, "calculate": calculate}
    mappings = {}
    for name, location in inputs.items():
        old_origin, path_prefix, expected = SOURCES[name]
        old_urls = read_sitemap(location, old_origin, expected)
        mappings[name] = [
            APEX + path_prefix + url.removeprefix(old_origin) for url in old_urls
        ]
    copy_static(image, root)
    copy_static(random, root / "random")
    copy_static(calculate, root / "calculate")
    update_text_files(root)
    brand_image_site(root)
    add_cross_navigation(root)
    home_sections(root)
    merged_urls = [url for name in ("image", "random", "calculate") for url in mappings[name]]
    create_sitemap(root, merged_urls)
    validate_site(root, merged_urls)

def apply(root: Path, dest: Path) -> None:
    if not (dest / ".git").is_dir():
        raise RuntimeError("Target must be a real Git checkout, never a live web root.")
    if not (dest / "scripts/build_unified_everytinytool.py").is_file():
        raise RuntimeError("Checkout the dedicated migration branch first.")
    removed = []
    for item in dest.iterdir():
        if item.name in PROTECT_TARGET or item.name.startswith("."):
            continue
        if item.is_dir():
            shutil.rmtree(item)
        else:
            item.unlink()
        removed.append(item.name)
    for item in root.iterdir():
        target = dest / item.name
        if item.is_dir():
            shutil.copytree(item, target)
        else:
            shutil.copy2(item, target)
    print("Site files copied to release checkout. Still NOT deployed.")
    print("Review removed legacy paths:", ", ".join(sorted(removed)))

def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--image-source", type=Path, required=True)
    p.add_argument("--random-source", type=Path, required=True)
    p.add_argument("--calculate-source", type=Path, required=True)
    p.add_argument("--target", type=Path, required=True)
    mode = p.add_mutually_exclusive_group(required=True)
    mode.add_argument("--stage", type=Path)
    mode.add_argument("--apply", action="store_true")
    args = p.parse_args()
    image, random, calculate, target = (
        args.image_source.resolve(), args.random_source.resolve(),
        args.calculate_source.resolve(), args.target.resolve(),
    )
    if any(not x.is_dir() for x in (image, random, calculate, target)):
        p.error("All four source/target directories must exist.")
    with tempfile.TemporaryDirectory(prefix="everytinytool-merge-") as tmp:
        generated = Path(tmp) / "website"
        assemble(generated, image, random, calculate)
        if args.apply:
            apply(generated, target)
        else:
            stage = args.stage.resolve()
            if stage.exists():
                raise RuntimeError(f"Refusing to overwrite staging path: {stage}")
            if stage == target or target in stage.parents:
                raise RuntimeError("Stage outside the target checkout.")
            shutil.copytree(generated, stage)
            print(f"Dry-run output: {stage}")

if __name__ == "__main__":
    main()
