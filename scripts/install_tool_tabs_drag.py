#!/usr/bin/env python3
"""Install shared tab drag-scroll assets into staged unified Image pages.

The unified build clones a pinned image source, so checkout-only edits to
assets/ are not automatically served. This step explicitly overlays the fix
into dist and injects it in all image pages (English and Korean).
"""
from pathlib import Path
import shutil
import sys

def main() -> None:
    root = Path(sys.argv[1]).resolve()
    source = Path(__file__).resolve().parent.parent / "assets"
    assets = root / "assets"
    assets.mkdir(exist_ok=True)
    for name in ("tool-tabs-drag.css", "tool-tabs-drag.js"):
        shutil.copyfile(source / name, assets / name)
    changed = 0
    for html_file in sorted(root.rglob("index.html")):
        relative = html_file.relative_to(root).parts
        if relative[0] in ("random", "calculate"):
            continue
        html = html_file.read_text("utf-8")
        if "tool-tabs-drag.js" in html:
            continue
        if "</head>" not in html:
            raise RuntimeError(f"Missing </head> in {html_file}")
        extra = ('<link rel="stylesheet" href="/assets/tool-tabs-drag.css">'
                 '<script defer src="/assets/tool-tabs-drag.js"></script>')
        html_file.write_text(html.replace("</head>", extra + "</head>", 1), "utf-8")
        changed += 1
    if changed < 20:
        raise RuntimeError(f"Too few image pages patched: {changed}")
    print(f"Drag-scroll installed: {changed} image pages, including Korean pages.")

if __name__ == "__main__":
    main()
