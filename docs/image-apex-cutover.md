# Image Everything → everytinytool.com 통합 전환 계획 (2026-11-10)

## 결정 사항

- `https://everytinytool.com/`의 **기존 Every Tiny Tool 허브를 새 Image Everything으로 전면 교체**한다. 이름·내비게이션·도구·가이드·한국어 사이트 모두 이전 대상이다.
- 원본: `ji-minseo/image-everything`의 `feature/guides-migration-20261031`. 기존 독립 디자인 미리보기: https://image-everything-design-preview.vercel.app/
- 대상 저장소: `ji-minseo/everytinytool`. 기존 `main`은 교체 전까지 유지하고, 본 작업은 `feature/image-everything-apex-migration-20261110`에서 준비한다.
- 이전 **64개 URL**(영/한 홈·도구 34·가이드 19·정보 9)을 새 도메인 기준으로 옮긴다. 단, 이 페이지 수는 원본 브랜치를 검증하는 스크립트의 엄격한 기대값이며 실제 배포 결과로 확인해야 한다.
- `image.everytinytool.com`의 파일과 DNS는 즉시 삭제하지 않는다. 새 메인이 검증되면 **각 기존 URL과 새 메인의 동일 경로를 연결하는 301**을 Cloudflare의 호스트 수준 redirect rule로 설정한다. 301 확인 전에는 원본을 유지한다.
- 다른 서브도메인(`pickacard`, `calculate`, `random`, `saju` 등)은 유지한다. 이 프로젝트에서 그쪽 DNS·배포·결제·webhook을 변경하지 않는다.

## 자동 준비 도구

`scripts/migrate_image_to_apex.py`는 정적 웹 소스를 복사하고 텍스트 HTML/JS/CSS/XML/JSON 내 `https://image.everytinytool.com`을 `https://everytinytool.com`으로 변경한다. **사이트맵 64개 고유 URL, 모든 HTML 페이지의 canonical, 64개 페이지 존재 여부, 주요 JS/CSS 도구 파일 존재 여부**를 확인한다.

기존 메인 저장소 `main`의 코드를 직접 덮어쓰지 않고, 먼저 현재 브랜치의 GitHub Actions `Verify Image Everything apex migration`에서 **dry-run**하도록 한다. 액션에는 Cloudflare 자격증명, 배포 권한 또는 DNS 변경 권한이 없다.

로컬 예시:

```bash
git clone -b feature/image-everything-apex-migration-20261110 https://github.com/ji-minseo/everytinytool.git apex
git clone -b feature/guides-migration-20261031 https://github.com/ji-minseo/image-everything.git image
python3 apex/scripts/migrate_image_to_apex.py --source image --target apex --stage /tmp/image-apex-preview
```

생성 폴더를 브라우저/로컬 서버로 확인한 후, **릴리스 브랜치에서만**:

```bash
python3 apex/scripts/migrate_image_to_apex.py --source image --target apex --apply
git -C apex status --short
```

이 단계는 로컬 파일 교체만 한다. 운영 배포는 별도의 승인된 PR 병합/Cloudflare 배포 과정으로 이루어진다.

## 보존하고 삭제할 것

- 기존 허브의 랜딩, 인라인 이미지/PDF/영상 편집기, 이미지 관련 중복 페이지/가이드, 기존 노출용 정적 자산은 교체한다. `/metadata-inspector/`, `/metadata-cleaner/`, `/guides/...`처럼 새 사이트에 대응되는 경로는 동일 경로를 유지하며 새 콘텐츠로 대체된다.
- 기존 루트에서 이미지 도구로 대응되는 일부 주소는 `_redirects`로 301. `/quick-image-studio/` → `/`, `/video-studio/` → `/video-compressor/`.
- `/workspace/`, `/word-counter/`, `/actual-size-ruler/`, `/list-comparer/`, 리스트·자로 구성된 오래된 가이드 등 이미지 사이트와 무관한 URL은 별도 검토 없이 관련 없는 새 페이지로 무작정 301하지 않는다. 삭제 시 404가 가능하므로 Search Console 실적을 먼저 확인할 것. 필요하면 별도 보관 경로로 이전.
- `.github`, `functions`, `api`, `_worker.js`, `_routes.json`, `.well-known`, `wrangler.*`, `package.json` 및 운영 환경 연결 파일을 **자동 삭제 대상에서 제외**한다. 결제 경로가 여기에 있는지 실제 배포 환경에서 확인하기 전에는 병합 금지.
- 버전 이력은 Git에 보존된다. 원본 `main`을 별도 보관 브랜치/태그로 고정하고 배포 전에 실제 Cloudflare 스냅샷을 저장하는 것이 권장된다.

## 실제 전환 직전 필수 게이트

1. `everytinytool.com`이 연결된 **Cloudflare Pages/Workers 프로젝트**와 배포 브랜치, 환경 변수, 결제/리턴 URL/webhook/커스텀 도메인 라우트 식별. 이 대화 환경에는 Cloudflare 계정 연결 도구가 없어 아직 직접 확인하지 못했다.
2. 원본 Image Everything Draft PR과 브랜치 비교: 현재 새 디자인이 소스 브랜치에 최신으로 들어 있는지 확인. 사이트 본문, 기능 스크립트, 한국어 링크, 가이드 자산, 파비콘, 사이트맵을 점검.
3. 생성된 64개 URL의 HTTP 200, JS/CSS 로드 성공, 몇 가지 대표 이미지·PDF·영상 처리, 모바일 메타데이터 클리너 확인. 광고 쿠키 동의·Privacy·Terms도 확인.
4. 신규 `everytinytool.com`의 canonical/hreflang/사이트맵/OG와 robots 일치 검증. 기존 메인 사이트에 이미 색인된 URL 목록을 내보낸 뒤 리디렉션 표를 작성.
5. 배포 뒤 `https://everytinytool.com/`의 200 확인, 운영 웹훅 정상, 기존 서브도메인/다른 유료 기능 정상 확인.
6. 마지막으로 `image.everytinytool.com/*` → `everytinytool.com/*`의 **서버 측 301**, 충돌이 없는 루트 URL을 확인하고 Google Search Console에 새 사이트맵 제출. 서브도메인을 먼저 삭제하거나 `robots.txt`로 차단하면 301을 수집하지 못할 수 있다.

## 색인과 순위

현재 메인 사이트 일부가 색인된 정황은 있지만, 메인 도메인에 통합한다고 검색 노출이 자동 증가하는 것은 아니다. 기존에 색인된 URL을 유지할 수 있는 경우는 유지하고, 변경해야 할 URL만 301 처리한다. 사이트 내용과 주요 주제가 크게 바뀌므로 검색 성과가 일시적으로 변할 수 있다.

**상태:** 마이그레이션 코드와 CI 정적 dry-run 준비. 운영 사이트 파일·Cloudflare DNS·결제·구글 색인은 아직 변경하지 않음.
