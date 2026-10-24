#!/usr/bin/env python3
"""Post-merge deployed HTML smoke check. Read only; never simulates Googlebot."""
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

CHECKS = [
  ("main sitemap has metadata inspector", "https://everytinytool.com/sitemap.xml", "<loc>https://everytinytool.com/metadata-inspector/</loc>"),
  ("main sitemap has metadata cleaner", "https://everytinytool.com/sitemap.xml", "<loc>https://everytinytool.com/metadata-cleaner/</loc>"),
  ("image sitemap lists video compressor", "https://image.everytinytool.com/sitemap.xml", "<loc>https://image.everytinytool.com/video-compressor/</loc>"),
  ("image sitemap lists metadata inspector", "https://image.everytinytool.com/sitemap.xml", "<loc>https://image.everytinytool.com/metadata-inspector/</loc>"),
  ("image sitemap lists metadata cleaner", "https://image.everytinytool.com/sitemap.xml", "<loc>https://image.everytinytool.com/metadata-cleaner/</loc>"),
  ("image en/ko hreflang published", "https://image.everytinytool.com/compress-image/", 'hreflang="ko"'),
  ("random 404 home link fixed", "https://random.everytinytool.com/404.html", 'href="/"'),
  ("random 404 excluded from index", "https://random.everytinytool.com/404.html", 'content="noindex, follow"'),
  ("calculate Korean formula script updated", "https://calculate.everytinytool.com/ko/age-calculator/", "20261024-formula-target"),
  ("Pick a Card page-cache declaration published", "https://pickacard.everytinytool.com/moonlit-room.js", "\nconst pageCache=new Map();"),
  ("Pick a Card navigation head sync published", "https://pickacard.everytinytool.com/moonlit-room.js", "robots_meta" if False else "const pageHead="),
  ("Pick a Card ambient toggle CSS preserved", "https://pickacard.everytinytool.com/moonlit-room.js", "persistentStyles=new Set(['/moonlit-room.css','/moonlit-cursor.css'])"),
]
def retrieve(url):
    try:
        req=Request(url,headers={"User-Agent":"Mozilla/5.0 (PostMergeSmokeCheck; read-only)"})
        try:
            response=urlopen(req,timeout=18)
        except HTTPError as exc:
            response=exc
        with response:
            return {"status":response.status,"final_url":response.url,
                    "content":response.read(1000000).decode("utf-8","replace")}
    except Exception as exc:
        return {"error":str(exc),"content":""}
def main():
    urls=dict.fromkeys(url for _,url,_ in CHECKS)
    fetched={url:retrieve(url) for url in urls}
    rows=[]
    for name,url,needle in CHECKS:
        result=fetched[url]
        yes=result.get("status")==200 and needle in result["content"]
        rows.append({"check":name,"url":url,"passed":yes,
                     "status":result.get("status"),"error":result.get("error")})
    Path("post-merge-smoke.json").write_text(json.dumps({"results":rows},indent=2,ensure_ascii=False),encoding="utf-8")
    lines=["# Post-merge live deployment smoke checks","","Checks ordinary HTTP responses, NOT Googlebot or Google indexing.","",
           "| Check | Deployed? | HTTP |","|---|---|---|"]
    for row in rows:
        lines.append(f"| {row['check']} | {'YES' if row['passed'] else 'NOT VERIFIED'} | {row.get('status') or row.get('error','?')} |")
    lines.append("")
    lines.append(f"Confirmed: {sum(row['passed'] for row in rows)}/{len(rows)}. Failed checks may reflect deployment propagation, inaccessible origins, or changed output paths.")
    md="\n".join(lines)+"\n"
    Path("post-merge-smoke.md").write_text(md,encoding="utf-8")
    print(md)
    import os
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"],"a",encoding="utf-8") as f:
            f.write(md)
if __name__=="__main__":
    main()
