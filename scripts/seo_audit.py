#!/usr/bin/env python3
"""Audit static SEO signals; --live probes the five public sites (read only).

Local results describe repository HTML, not deployed HTTP or Google indexing.
No third-party dependencies. Run: python scripts/seo_audit.py [--live]
"""
import argparse
from collections import Counter, deque
from html.parser import HTMLParser
import json
from pathlib import Path
from urllib.parse import urljoin, urlsplit
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.robotparser import RobotFileParser
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://everytinytool.com'
SITES = [ORIGIN, *[f'https://{s}.everytinytool.com' for s in ('image', 'random', 'calculate', 'pickacard')]]


class Page(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.title = ''; self.headings = []; self.meta = {}; self.canonicals = []
        self.links = []; self.assets = []; self.schemas = []; self.errors = []
        self.text = []; self._title = False; self._heading = None
        self._script = None; self._skip = 0
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'title': self._title = True
        if tag in ('script', 'style'): self._skip += 1
        if tag.startswith('h') and tag[1:] in ('1', '2', '3', '4', '5', '6'):
            self.headings.append([int(tag[1]), '']); self._heading = len(self.headings) - 1
        if tag == 'meta': self.meta.setdefault(a.get('name', a.get('property', '')).lower(), []).append(a.get('content', ''))
        if tag == 'link' and 'canonical' in a.get('rel', '').lower().split(): self.canonicals.append(a.get('href', ''))
        if tag == 'a' and 'href' in a: self.links.append(a['href'])
        if tag in ('script', 'img', 'iframe') and a.get('src'): self.assets.append(a['src'])
        if tag == 'link' and 'stylesheet' in a.get('rel', '').split(): self.assets.append(a.get('href', ''))
        if tag == 'script' and a.get('type') == 'application/ld+json': self._script = ''

    def handle_data(self, data):
        if self._title: self.title += data
        if self._heading is not None: self.headings[self._heading][1] += data
        if self._script is not None: self._script += data
        if not self._skip and data.strip(): self.text.append(data.strip())

    def handle_endtag(self, tag):
        if tag == 'title': self._title = False
        if tag.startswith('h') and tag[1:].isdigit(): self._heading = None
        if tag == 'script' and self._script is not None:
            try: self.schemas.append(json.loads(self._script))
            except ValueError as e: self.errors.append(f'invalid JSON-LD: {e}')
            self._script = None
        if tag in ('script', 'style'): self._skip = max(0, self._skip - 1)


def locations(xml):
    return [e.text for e in ET.fromstring(xml).iter() if e.tag.endswith('}loc') or e.tag == 'loc']


def local_audit(root=ROOT):
    pages = {}
    for file in sorted(root.rglob('index.html')):
        if any(p in ('work', 'node_modules', '.git') for p in file.relative_to(root).parts): continue
        rel = file.parent.relative_to(root).as_posix()
        url = ORIGIN + ('/' if rel == '.' else '/' + rel + '/')
        pages[url] = Page(file.read_text())
    sitemap = locations((root / 'sitemap.xml').read_text())
    robots = RobotFileParser()
    robots_text = (root / 'robots.txt').read_text()
    robots.parse(robots_text.splitlines())
    errors = []; warnings = []; inventory = []
    if 'Sitemap: ' + ORIGIN + '/sitemap.xml' not in robots_text:
        errors.append({'issue': 'robots.txt does not advertise the primary sitemap'})
    for url, p in pages.items():
        def error(message): errors.append({'url': url, 'issue': message})
        if len(p.canonicals) != 1: error('expected exactly one canonical')
        canonical = p.canonicals[0] if p.canonicals else None
        if not p.title.strip(): error('missing title')
        if len(p.meta.get('description', [])) != 1: error('expected one description')
        if sum(h[0] == 1 for h in p.headings) != 1: error('expected one H1')
        directives = ','.join(p.meta.get('robots', []) + p.meta.get('googlebot', [])).lower()
        if 'noindex' in directives or 'nofollow' in directives: error('restrictive robots meta')
        if not robots.can_fetch('Googlebot', url): error('robots.txt blocks Googlebot')
        if canonical == url and url not in sitemap: error('self-canonical page missing from sitemap')
        if canonical != url: warnings.append({'url': url, 'issue': 'cross-domain canonical requires live target/content validation', 'canonical': canonical})
        for e in p.errors: error(e)
        for schema in p.schemas:
            nodes = schema if isinstance(schema, list) else [schema]
            for node in nodes:
                if node.get('@type') in ('WebApplication', 'Article'):
                    identity = node.get('url', node.get('mainEntityOfPage'))
                    if isinstance(identity, str) and identity != canonical: error('JSON-LD identity differs from canonical')
        for href in p.links + p.assets:
            dest = urlsplit(urljoin(url, href))
            if dest.netloc != urlsplit(ORIGIN).netloc: continue
            if href in p.assets and not robots.can_fetch('Googlebot', dest.geturl()): error('robots.txt blocks local rendering resource')
            target = root / dest.path.lstrip('/')
            if not target.exists(): error('missing local link/resource: ' + dest.path)
        if not p.meta.get('og:title'): warnings.append({'url': url, 'issue': 'Open Graph absent (sharing enhancement, not indexing blocker)'})
        for prev, cur in zip(p.headings, p.headings[1:]):
            if cur[0] > prev[0] + 1: warnings.append({'url': url, 'issue': f'heading level jump H{prev[0]} to H{cur[0]}'}); break
        inventory.append({'url': url, 'title': p.title, 'description': p.meta.get('description'), 'canonical': canonical, 'h1': [h[1] for h in p.headings if h[0] == 1], 'text_words': len(' '.join(p.text).split()), 'jsonld_types': [s.get('@type') for s in p.schemas if isinstance(s, dict)]})
    for field in ('title', 'description'):
        values = [p.title if field == 'title' else str(p.meta.get(field)) for p in pages.values()]
        for value, count in Counter(values).items():
            if count > 1: errors.append({'issue': f'duplicate {field}', 'value': value, 'count': count})
    for url in sitemap:
        if url not in pages: errors.append({'url': url, 'issue': 'sitemap URL missing locally'})
        elif pages[url].canonicals != [url]: errors.append({'url': url, 'issue': 'sitemap/canonical mismatch'})
    if len(sitemap) != len(set(sitemap)): errors.append({'issue': 'duplicate sitemap URLs'})
    reached = set(); queue = deque([ORIGIN + '/'])
    while queue:
        url = queue.popleft()
        if url in reached or url not in pages: continue
        reached.add(url)
        queue.extend(urljoin(url, href).split('#')[0].split('?')[0] for href in pages[url].links)
    for url in pages.keys() - reached: errors.append({'url': url, 'issue': 'not reachable from home via static anchors'})
    return {'scope': 'repository only', 'page_count': len(pages), 'sitemap_count': len(sitemap), 'reachable_count': len(reached), 'errors': errors, 'warnings': warnings, 'pages': inventory}


def live_audit():
    results = []
    def fetch(url, agent='Mozilla/5.0 SEOAudit'):
        row = {'requested_url': url, 'user_agent': agent}
        try:
            try:
                response = urlopen(Request(url, headers={'User-Agent': agent}), timeout=15)
            except HTTPError as response_error:
                response = response_error
            with response as r:
                body = r.read(4000000).decode('utf-8', errors='replace')
                row.update(status=r.status, final_url=r.url, headers=dict(r.headers), body=body)
        except Exception as e: row['transport_error'] = str(e)
        return row
    for site in SITES:
        pending = [site + '/', site + '/robots.txt', site + '/sitemap.xml', site + '/__seo_audit_missing_20261024/']
        seen = set()
        while pending and len(seen) < 300:
            url = pending.pop(0)
            if url in seen or urlsplit(url).netloc != urlsplit(site).netloc: continue
            seen.add(url); row = fetch(url); body = row.pop('body', '')
            if 'xml' in row.get('headers', {}).get('Content-Type', '') or url.endswith('.xml'):
                try: pending.extend(locations(body))
                except ET.ParseError: row['xml_error'] = 'not valid sitemap XML'
            elif body and not url.endswith('robots.txt'):
                p = Page(body); row.update(title=p.title, canonical=p.canonicals, robots=p.meta.get('robots'), h1=[h[1] for h in p.headings if h[0] == 1])
            else: row['text'] = body
            results.append(row)
        for url in (site + '/', 'http://' + urlsplit(site).netloc + '/'):
            row = fetch(url, 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'); row.pop('body', None); results.append(row)
    return {'scope': 'public HTTP; spoofed UA does not verify real Googlebot access', 'results': results}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--live', action='store_true')
    args = parser.parse_args()
    result = live_audit() if args.live else local_audit()
    print(json.dumps(result, indent=2, ensure_ascii=False))
    raise SystemExit(bool(result.get('errors')) or any('transport_error' in r for r in result.get('results', [])))
