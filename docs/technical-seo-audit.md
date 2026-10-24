# 재사용 가능한 기술 SEO 점검 기준

## 범위와 증거

1. 저장소·브랜치·기준 SHA·변경 사항·배포 워크플로를 먼저 기록한다. Git 커밋 시각과 실제 배포 완료 시각을 구분한다.
2. 코드, 로컬 브라우저, 운영 HTTP, 실제 Googlebot 로그, Search Console 결과를 각각 구분한다. 하나를 다른 것의 검증 결과로 대신하지 않는다.
3. 상태는 `확인된 결함 / 정상 확인 / 미검증 / 가설`로 남긴다. 프록시 CONNECT 실패나 테스트 환경 오류를 운영 사이트 오류로 기록하지 않는다.
4. Search Console에서 `이전 색인 후 제외 / 최초부터 미색인 / 색인 유지·노출 감소 / 실제 크롤링 장애`를 구분한다. 동시 발생 여부는 호스트별 일별 데이터로 확인한다.
5. 현재 연결된 코드만 수정한다. 다른 사이트를 조사할 때는 공개 접근과 코드 접근 범위를 명시하고, 별도 승인 없이 그 사이트의 코드를 수정하거나 배포하지 않는다.

## 점검 표본과 판정

| 영역 | 검사 방법 | 판정 시 주의 |
| --- | --- | --- |
| HTTP | 홈·핵심 도구·가이드·없는 경로·sitemap/robots의 GET 응답과 최종 URL, redirect chain 확인 | HEAD만으로 판정하지 않는다. 없는 경로의 200은 본문과 함께 soft 404 가능성을 조사한다. |
| 정규화 | HTTP/HTTPS, www/non-www, 슬래시, index.html, 기능 쿼리/추적 쿼리 비교 | 기능 쿼리를 무조건 제거하거나 redirect하지 않는다. |
| 색인 지시 | robots.txt, robots/googlebot meta, X-Robots-Tag 비교 | robots 차단은 noindex와 다르다. 차단 페이지의 noindex를 크롤러가 읽지 못할 수 있다. |
| 렌더링 | raw HTML과 JS on/off의 본문·title·H1·canonical·JSON-LD·링크 비교, 자원 실패/JS 예외 기록 | 초기 본문이 적다는 이유만으로 미색인 판정하지 않는다. 로컬 Chromium은 Google WRS를 대체하지 않는다. |
| 발견 | sitemap URL 전수 검사, 홈에서 정적 a[href] 탐색 | sitemap 제출·내부 링크 존재는 색인 등록을 보장하지 않는다. |
| 대표 URL | canonical 개수·절대 URL·리다이렉트·sitemap·구조화 데이터 identity 비교 | 의도적인 cross-domain 통합을 무조건 되돌리지 않는다. Google 선택 canonical은 GSC로 확인한다. |
| 콘텐츠 | 고유 메타·H1·검색 의도·실제 기능·본문 예시·사이트 간 중복 비교 | 글자 수·주제 유사성만으로 삭제/noindex하지 않는다. |
| 구조화 데이터 | JSON 구문, 페이지 내용 일치, 타입별 필수 속성 검증 | JSON 파싱 성공과 Google 리치 결과 적격성은 다르다. |
| UI·기능 | 주요 도구 실제 입력→처리→결과/다운로드, 모바일·데스크톱·키보드 확인 | 광고·모델·CDN을 차단/로컬 대체했다면 운영 가용성을 검증한 것으로 쓰지 않는다. |

정적 검사에서 title/description 중복과 H1 개수를 탐지하지만, 현재 저장소의 품질 기준이지 모든 사이트에 적용되는 Google 색인 필수 조건은 아니다. Open Graph 부재도 색인 차단으로 분류하지 않는다.

## Cross-domain canonical 배포 전 확인

원본 URL과 대상 URL을 **한 쌍**으로 검사한다.

- 대상의 실제 GET 200과 콘텐츠를 확인한다. 로그인·보안 challenge·오류 페이지·soft 404가 아닌지 본다.
- 대상이 의도한 대표 URL을 canonical로 선언하는지, noindex/robots/X-Robots-Tag 차단이 없는지 확인한다.
- 원본과 대상의 기능·본문·검색 의도가 동등해 통합할 근거가 있는지 확인한다.
- canonical/redirect가 서로 되돌아오는 순환, 다른 호스트로의 체인, 중복 canonical을 검사한다.
- sitemap은 각 호스트의 색인 대상 대표 URL과 맞추고 JSON-LD identity도 그 대표 URL에 맞춘다.
- URL 검사에서 사용자 선언 canonical과 Google 선택 canonical을 대조한다. UA 문자열을 Googlebot으로 바꾸는 것만으로 실제 Googlebot 접근을 입증하지 않는다.

### 이 PR에서 남은 배포 위험 (2026-10-24)

| 기존 canonical 대상 | 확인 결과 |
| --- | --- |
| https://image.everytinytool.com/pdf-compressor/ | 환경 프록시의 HTTPS CONNECT 403으로 원본 서버 도달 불가. 운영 200·본문·self-canonical·색인 지시 미검증 |
| https://image.everytinytool.com/remove-background/ | 동일 |

이 PR은 기존 canonical을 변경하지 않고 JSON-LD URL만 그 canonical에 맞춘다. 대상이 실제로 누락/차단되거나 비동등 콘텐츠라면 원본 페이지의 대표성·색인 신호가 부적절한 URL로 전달될 위험이 있다. JSON-LD 정렬은 잘못된 대표 URL 신호를 더 일관되게 만들 수도 있으므로 대상 정상 여부가 확인되기 전에는 안전한 통합이라고 판단하지 않는다. canonical 대상의 운영 검증을 배포 전 미해결 항목으로 유지한다. 이 PR은 병합·배포하지 않는다.

## 현재 메인 저장소의 자동 검사

저장소 루트에서 실행한다. Python 표준 라이브러리와 Node를 사용한다.

```sh
python -B scripts/seo_audit.py
python -B -m unittest discover -s tests -p seo_audit_test.py -v
node --test tests/*.test.js
for file in assets/*.js; do
  node --check "$file" || exit 1
done
git diff --check
```

`seo.yml`은 PR에서 정적 SEO·Python 결함 주입 테스트·Node 22 전체 테스트·JS 구문 검사를 실행한다. 브라우저·실 Googlebot·GSC 검증은 CI에 포함되지 않는다.

`scripts/seo_audit.py`의 로컬 검사는 다음을 포함한다.

- index.html 전수 목록, title/description 중복, canonical/H1 개수, robots meta
- self-canonical 페이지의 sitemap 포함과 sitemap/canonical 일치
- JSON-LD 파싱 및 Article/WebApplication의 대표 URL 일치
- 사이트 내 정적 링크/리소스 파일 존재, 홈에서 실제 앵커 링크 도달
- 로컬 robots 규칙과 sitemap 선언

외부 접근이 허용된 환경에서는 공개 응답을 별도로 기록한다.

```sh
python -B scripts/seo_audit.py --live > live-seo-results.json
```

현재 스크립트의 `ROOT`, `ORIGIN`, `SITES`는 Every Tiny Tool에 맞춰져 있다. 다른 저장소에 재사용할 때는 해당 사이트와 산출물 경로에 맞춰 조정한다. `--live`는 호스트별 최대 300개 sitemap URL을 따라가며 응답·최종 URL·헤더·초기 HTML 신호를 기록한다. 완전한 redirect chain/정규화/JS 렌더링 검사는 별도로 필요하다. 로컬 파일 존재로 운영 HTTP 200을 증명할 수 없다.

## 수정과 검증 기록

- P0: 검증된 핵심 접근 차단·잘못된 응답·렌더링 장애. P1: 검증된 발견/메타/대표 URL/구조화 데이터 정합성 문제. P2: 콘텐츠·정보 구조·공유 메타·장기 개선 제안.
- 기존 UI·도구·결제·광고·분석·추적 코드를 보존하고 최소 변경을 우선한다. 가설만으로 전체 렌더링 구조를 교체하지 않는다.
- 테스트가 실패하면 먼저 수정 전 재현하고 실제 동작과 대조한다. 낡은 개수·ID·sitemap 가정은 현재 기능의 대응 관계와 의도를 검사하도록 바꾼다. 테스트를 삭제·skip하거나 실패를 무시하지 않는다.
- 결과에는 기준 SHA, 수정 파일, 테스트 명령/버전, 성공·실패·미실행과 이유, 외부 의존성 대체 여부, 남은 배포 위험을 기록한다.
- 배포는 별도 승인 범위에서 진행하고, 배포 후 고정 URL 집합의 크롤링 오류·선택 canonical·색인 사유·노출/클릭을 추적한다. 검색 순위·색인 회복 시점을 보장하지 않는다.
