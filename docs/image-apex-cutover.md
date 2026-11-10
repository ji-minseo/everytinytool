# Every Tiny Tool 단일 도메인 통합 전환 계획 — 2026-11-10

## 최종 구조

**메인 브랜드: Every Tiny Tool** (`https://everytinytool.com`)

| 기능 | 새 경로 | 원본 |
| --- | --- | --- |
| 메인, 이미지·PDF·동영상, 메타데이터 도구 및 가이드 | `/`, `/compress-image/`, `/guides/`, `/ko/...` | `ji-minseo/image-everything` → **반드시 `feature/guides-migration-20261031`의 고정 커밋 `8d21f13f29f475587e1368e97f08606d626fb4b6`**. `main` 아님 |
| 랜덤 생성 도구 | `/random/`, `/random/wheel-decider/` 등 | `ji-minseo/random-everything` main |
| 일상 계산기 | `/calculate/`, `/calculate/ko/age-calculator/` 등 | `ji-minseo/calculate-everything` main |

- 이미지 사이트 기존 검증 대상 64개 + Random 11개 + Calculate 20개 = **총 95개 정적 URL**.
- 랜덤·계산기 도구는 각자의 `assets/` 폴더를 하위 경로에 그대로 복사해 CSS/JS 충돌을 피한다.
- 사용자에게는 Image Everything/Random Everything/Calculate Everything의 서로 다른 브랜드보다 **Every Tiny Tool**이라는 하나의 브랜드와 세 분야를 보여준다.
- 기존 이미지 메인 디자인(코발트 UI, 가이드 포함)을 유지하되 메인 상단 헤더/히어로/도구 분류를 Every Tiny Tool로 리브랜딩한다. 이미지 17개 도구의 URL을 `/image/` 아래로 추가 이동시키지 않는다.
- `pickacard`, `saju`, `readingroom`, 기타 서비스는 그대로 유지한다. 이 단계에서 다른 결제/도메인/워커를 수정하지 않는다.

## 실제 구현

`scripts/build_unified_everytinytool.py`는 3개 Git 저장소를 읽고 **로컬 산출물만** 생성한다.

- `image.everytinytool.com` → `everytinytool.com`
- `random.everytinytool.com` → `everytinytool.com/random`
- `calculate.everytinytool.com` → `everytinytool.com/calculate`
- 기존 하위 경로 유지, 브라우저용 상대 경로 보존, 사이트 전체에 3분야 내비게이션 연결.
- 메인 EN/KO 홈의 브랜드와 카테고리 카드 교체.
- **95개 URL·canonical·사이트맵·필수 정적 파일·분야 간 이동 링크** 검증.
- `robots.txt`에 단일 사이트맵 연결, 레거시 루트 경로 중 실제 대응되는 일부만 리디렉션.
- 자동으로 DNS·Cloudflare Workers·Search Console·결제 웹훅은 변경하지 않는다.

### PR dry-run

`.github/workflows/image-apex-migration-verify.yml`은 각 저장소를 읽어 임시 폴더에 통합 결과를 생성하고 검증하도록 설정되어 있다. 실제 워크플로 실행 성공 여부는 GitHub Actions에서 확인해야 한다.

### 수동 스테이징

```bash
git clone -b feature/image-everything-apex-migration-20261110 https://github.com/ji-minseo/everytinytool.git apex
git clone -b feature/guides-migration-20261031 https://github.com/ji-minseo/image-everything.git image
git clone https://github.com/ji-minseo/random-everything.git random
git clone https://github.com/ji-minseo/calculate-everything.git calculate
python3 apex/scripts/build_unified_everytinytool.py --image-source image --random-source random --calculate-source calculate --target apex --stage /tmp/everytinytool-preview
```

검증 후 준비 브랜치에서만 다음 명령으로 공개 정적 파일을 교체하고 Git diff를 검토한다. **이 작업만으로 운영 사이트가 배포되지는 않는다.**

```bash
python3 apex/scripts/build_unified_everytinytool.py --image-source image --random-source random --calculate-source calculate --target apex --apply
git -C apex status --short
```

## 백업 및 보호

- 메인 저장소의 원래 콘텐츠는 `backup/everytinytool-before-image-20261110` 브랜치에 보존한다.
- 통합 작업은 `feature/image-everything-apex-migration-20261110` 브랜치의 Draft PR에서만 진행한다.
- `functions/`, `api/`, `_worker.js`, `_routes.json`, `.github/`, `wrangler.*`, `.well-known/`과 각종 배포 설정은 제거 대상에서 보호한다.
- 기존 `/workspace/`, `/word-counter/`, `/list-comparer/`, `/actual-size-ruler/`처럼 통합에서 빠지는 URL은 Search Console 실적 확인 후 별도 301/410/이전 여부를 결정한다. 관련 없는 페이지로 무조건 301하지 않는다.
- 현재 Cloudflare 계정 직접 수정 도구가 연결되어 있지 않아 **실제 운영 도메인의 배포 라우팅·결제 웹훅은 아직 확인되지 않았다.**

## 출시 게이트

1. GitHub Actions 통합 빌드 통과, 산출물 95개 페이지 및 최소 핵심 도구의 브라우저 기능 QA.
2. 기존 `everytinytool.com` Cloudflare Pages/Workers 설정, 도메인/브랜치/환경 변수와 운영 결제 웹훅/리턴 URL 확인. 기존 별도 서비스로 가는 경로가 끊기지 않아야 한다.
3. 원본 앱의 로컬 CSS/JS/이미지 링크와 외부 라이브러리, 광고·개인정보처리방침·동의 기능을 점검한다.
4. `everytinytool.com` 최종 배포, 랜덤·계산기·이미지의 주요 도구와 한/영 사이트 및 기존 결제 경로 확인.
5. **그 후** Cloudflare 호스트 수준 301 규칙으로 `image.everytinytool.com/<path>` → `everytinytool.com/<path>`, `random.everytinytool.com/<path>` → `everytinytool.com/random/<path>`, `calculate.everytinytool.com/<path>` → `everytinytool.com/calculate/<path>` 전환. 쿼리스트링과 경로 유지, 무한 리디렉션 방지.
6. 세 서브도메인의 기존 사이트는 301 경유를 유지해야 하므로 **DNS를 무작정 삭제하거나 먼저 robots.txt로 차단하지 않는다**. 신속한 롤백 가능하도록 원본 프로젝트도 보존.
7. Search Console에서 새 사이트맵 제출하고 기존 색인 URL 및 클릭/노출 추이 관찰. 단일 도메인 통합 자체가 색인·랭킹 상승을 보장하지는 않는다.

**현재 상태:** 통합 생성 코드와 CI 검증 준비. 운영 사이트, Cloudflare 설정, 세 서브도메인, 결제 서비스는 변경하지 않았다.

## 2026-11-10 후속 점검 결과 (운영 미전환)

- Vercel 통합 미리보기 프로젝트 `everytinytool-unified-preview`의 빌드 로그에서 `Validated 95 pages, 95 URLs, 3 integrated sections.`와 `Deployment completed` 확인. 빌드 통과는 실제 브라우저 기능/결제 QA 통과를 의미하지 않는다.
- 미리보기 프로젝트의 Vercel Authentication (SSO)이 `all_except_custom_domains`로 활성화되어 있다. 익명 HTTP/브라우저 검사가 막힐 수 있으므로, 접근 실패를 사이트 기능 오류로 단정하지 않는다. 인증된 미리보기로 QA하거나 별도 안전한 접근 경로를 구성할 것. **인증 보호를 임의로 해제하지 않는다.**
- 원본 통합 리포지토리의 `vercel.json`은 미리보기 전체에 `X-Robots-Tag: noindex, nofollow`를 부여한다. 이 파일을 그대로 운영 Vercel 프로젝트에 사용한다면 검색 색인이 차단된다. 운영 도메인에서는 해당 헤더가 없어야 한다는 점을 릴리스 전에 HTTP 응답으로 검사할 것.
- 자동 검증 워크플로는 마이그레이션 PR의 모든 변경에서 실행되도록 수정했다(커밋 `6d24d2a`). 최신 GitHub Actions 실행의 성공은 별도로 확인 필요.
- 운영 이전에 필수로 확인할 것: (1) Cloudflare에서 실제 `everytinytool.com`을 서빙하는 프로젝트/브랜치/빌드 디렉터리 (2) `functions/`, `api/`, `_worker.js`, `_routes.json`의 실사용 경로 (3) 다른 유료 서비스 결제 시작/리턴 URL 및 webhook 목적지 (4) Google Ads/AdSense 및 동의 배너 (5) 모바일 브라우저의 이미지·메타데이터·영상 파일 처리.
- 운영 메인 변경 전부터 `image`, `random`, `calculate` 호스트의 DNS/프로젝트를 해제하지 않는다. 메인 200과 기능 검증을 마친 **후에만** 호스트별 301을 활성화하고 기존 자산을 롤백용으로 보존한다.

