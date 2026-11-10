#!/usr/bin/env python3
"""Stage the reviewed Image Everything static site at the everytinytool.com apex.

This is a local file migration only: it does NOT edit DNS, Cloudflare, GSC,
another subdomain, or any payment processor. Run --stage first, review output,
then run --apply on the release branch when ready.
"""
from __future__ import annotations

import argparse
from html.parser import HTMLParser
from pathlib import Path
import re
import shutil
import tempfile

OLD_ORIGIN = "https://image.everytinytool.com"
NEW_ORIGIN = "https://everytinytool.com"
EXPECTED_PAGES = 64
TEXT_SUFFIXES = {".html", ".css", ".js", ".json", ".xml", ".txt", ".svg", ".webmanifest", ".md"}
SITE_FILES = {"index.html", "favicon.svg", "robots.txt", "sitemap.xml", "manifest.json", "site.webmanifest", "_headers"}
IGNORE_SOURCE = {
    ".git", ".github", ".vercel", ".devcontainer", "docs", "scripts", "tests",
    "node_modules", "coverage", "dist", "build", ".DS_Store",
    "README.md", "LICENSE", "package.json", "package-lock.json", "pnpm-lock.yaml",
    "yarn.lock", "wrangler.toml", "wrangler.json", "wrangler.jsonc", "_redirects",
}
# Keep these operational files in the target repository, even when replacing
# its entire user-facing website. Check them before production deployment.
PROTECT_TARGET = {
    ".git", ".github", ".gitignore", ".well-known", ".devcontainer",
    "functions", "api", "_worker.js", "_routes.json",
    "wrangler.toml", "wrangler.json", "wrangler.jsonc",
    "package.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
    "README.md", "LICENSE", "scripts", "docs",
}

def source_entries(source: Path):
    for entry in sorted(source.iterdir()):
        if entry.name in IGNORE_SOURCE or entry.name.startswith("."):
            continue
        if entry.is_symlink():
            raise RuntimeError(f"Unexpected symlink in source: {entry}")
        if entry.is_dir() or entry.name in SITE_FILES:
            yield entry

def generate_site(source: Path, destination: Path) -> None:
    if not (source / "index.html").is_file():
        raise RuntimeError(f"Not an Image Everything static site: {source}")
    if not (source / "ko/guides/index.html").is_file():
        raise RuntimeError("Use the reviewed branch with all 64 pages, not old main.")
    if destination.exists():
        raise RuntimeError(f"Destination already exists: {destination}")
    destination.mkdir(parents=True)
    for entry in source_entries(source):
        to = destination / entry.name
        if entry.is_dir():
            shutil.copytree(entry, to, symlinks=False)
        else:
            shutil.copy2(entry, to)

    # Canonicals, sitemaps, hreflang, embedded JSON-LD and cross-domain tool
    # links must all use the same apex origin before serving the site.
    replaced = 0
    for p in destination.rglob("*"):
        if not p.is_file() or p.suffix.lower() not in TEXT_SUFFIXES:
            continue
        content = p.read_text("utf-8")
        if OLD_ORIGIN in content:
            p.write_text(content.replace(OLD_ORIGIN, NEW_ORIGIN), encoding="utf-8")
            replaced += 1

    # Old hub tools whose equivalents exist in the consolidated site.
    # No redirects from unrelated old tools to the homepage: leave those 404
    # until a distinct content-preserving migration plan is approved.
    (destination / "_redirects").write_text(
        "# Legacy Every Tiny Tool hub routes with a matching new tool.\n"
        "/quick-image-studio/ / 301\n"
        "/video-studio/ /video-compressor/ 301\n",
        encoding="utf-8",
    )
    validate_site(destination)
    print(f"Prepared static site: {destination}")
    print(f"Updated old-domain references in {replaced} text files.")

def validate_site(site: Path) -> None:
    html_files = sorted(site.rglob("index.html"))
    if len(html_files) != EXPECTED_PAGES:
        raise RuntimeError(f"Expected {EXPECTED_PAGES} HTML pages; got {len(html_files)}")
    sitemap = (site / "sitemap.xml").read_text("utf-8")
    urls = re.findall(r"<loc>(.*?)</loc>", sitemap)
    if len(urls) != EXPECTED_PAGES or len(set(urls)) != EXPECTED_PAGES:
        raise RuntimeError(f"Sitemap needs {EXPECTED_PAGES} unique entries; found {len(urls)}.")
    if any(not url.startswith(NEW_ORIGIN + "/") for url in urls):
        raise RuntimeError("Sitemap contains URLs outside apex domain.")

    for page in html_files:
        html = page.read_text("utf-8")
        rel = page.parent.relative_to(site)
        expected_path = "/" if str(rel) == "." else "/" + rel.as_posix() + "/"
        expected_url = NEW_ORIGIN + expected_path
        if f'<link rel="canonical" href="{expected_url}">' not in html:
            raise RuntimeError(f"Wrong canonical for {page}: expected {expected_url}")
        if OLD_ORIGIN in html:
            raise RuntimeError(f"Unmigrated source origin in {page}")
        if expected_url not in urls:
            raise RuntimeError(f"Missing sitemap URL: {expected_url}")
        if '<html lang="ko"' in html and "/ko/" not in expected_path:
            raise RuntimeError(f"KO locale at wrong path: {page}")

    required = [
        "assets/site-chrome.css", "assets/tools.js",
        "assets/metadata-workspace.js", "ko/guides/index.html",
        "guides/index.html", "ko/about/index.html",
        "ko/privacy/index.html", "ko/terms/index.html",
        "ko/contact/index.html", "metadata-cleaner/index.html",
    ]
    for file in required:
        if not (site / file).is_file():
            raise RuntimeError(f"Required page or asset missing: {file}")
    print(f"Validated {len(html_files)} pages and {len(urls)} distinct apex sitemap URLs.")

def apply_to_checkout(stage: Path, target: Path) -> None:
    if not (target / ".git").exists():
        raise RuntimeError(f"Target must be a Git repository checkout: {target}")
    if not (target / "scripts/migrate_image_to_apex.py").is_file():
        raise RuntimeError("Run inside the prepared everytinytool migration branch.")
    for item in stage.iterdir():
        if item.name in PROTECT_TARGET:
            raise RuntimeError(f"Refusing to overwrite an operational path: {item.name}")

    removed = []
    for item in sorted(target.iterdir()):
        if item.name in PROTECT_TARGET or item.name.startswith("."):
            continue
        if item.is_dir():
            shutil.rmtree(item)
        else:
            item.unlink()
        removed.append(item.name)

    for item in stage.iterdir():
        dest = target / item.name
        if item.is_dir():
            shutil.copytree(item, dest)
        else:
            shutil.copy2(item, dest)
    print("Replaced old public website files, preserving protected operational paths.")
    print("Old public root entries removed:", ", ".join(removed))
    print("Review git diff, run browser checks, and only then merge the release PR.")

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True,
                        help="Checkout of image-everything feature/guides-migration-20261031")
    parser.add_argument("--target", type=Path, required=True,
                        help="Checkout of everytinytool release branch")
    parser.add_argument("--apply", action="store_true",
                        help="Replace target checkout site files (never deploys remotely)")
    parser.add_argument("--stage", type=Path,
                        help="Write a clean output folder for review; no deletion.")
    args = parser.parse_args()
    source, target = args.source.resolve(), args.target.resolve()
    if source == target:
        parser.error("--source and --target cannot be the same directory")
    if not source.is_dir() or not target.is_dir():
        parser.error("Both source and target must exist.")
    if not args.apply and args.stage is None:
        parser.error("Choose --stage DIRECTORY or --apply.")
    if args.apply and args.stage:
        parser.error("--stage and --apply are mutually exclusive.")
    with tempfile.TemporaryDirectory(prefix="image-apex-stage-") as temp:
        built = Path(temp) / "site"
        generate_site(source, built)
        if args.apply:
            apply_to_checkout(built, target)
        else:
            stage = args.stage.resolve()
            if stage == target or target in stage.parents:
                parser.error("Stage outside the target repository to avoid accidental deployment.")
            shutil.copytree(built, stage)
            print(f"Dry-run output: {stage}")

if __name__ == "__main__":
    main()
