# GameSailor

Steam 할인 게임을 수집하고, 현재가/할인율/가격 이력/추천 점수 기준으로 정렬하는 포트폴리오용 대시보드입니다.

ECODOOBIZ 지원용 포트폴리오로, 단순 정적 페이지가 아니라 외부 API 연동, 서버리스 함수, 데이터 fallback, 필터/정렬 UI, 배포 환경 대응까지 보여주는 것을 목표로 만들었습니다.

## 배포 상태

- GitHub: `https://github.com/Haran1426/SteamSaleMap`
- Vercel: `https://steam-sale-map.vercel.app`
- Netlify 기존 주소: `https://steam-sale-map.netlify.app`
- Netlify 상태: 사용량 제한(`usage_exceeded`)으로 일시 차단된 적이 있어 Vercel 배포를 주 배포처로 사용합니다.

현재는 Vercel의 `/api/live-games` 서버리스 함수를 통해 실시간 데이터를 가져옵니다. Netlify에서 실행될 때는 `/.netlify/functions/live-games`를 먼저 시도하고, 실패하면 `/api/live-games`를 시도합니다.

## 주요 기능

- Steam 할인 게임 실시간 수집
- Steam featured categories와 Steam 할인 검색 결과 병합
- 기본 수집 한도 약 400개까지 확장
- Steam appdetails 기반 현재가, 정가, 할인율, 할인 종료일, 설명, 이미지 반영
- IsThereAnyDeal API 기반 게임 ID 매칭, 역대 최저가, 최근 가격 이력 반영
- 가격 이력이 부족한 게임은 현재 Steam 가격/역대 최저가 스냅샷 표시
- 할인율, 최저가 차이, 종료일, 태그를 활용한 추천 점수 계산
- 장르, 플레이 방식, 사양, 태그, 검색어 필터
- 추천 점수/할인율/가격/종료일 정렬
- 상세 모달, Steam 링크, CSV export
- API 실패 시 `games.json` 샘플 데이터 fallback

## 기술 스택

- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Netlify Functions, Vercel Serverless Functions
- External APIs: Steam Store API, IsThereAnyDeal API
- Deploy: Vercel, Netlify 대응

## 환경변수

Vercel 또는 Netlify에 아래 값을 설정해야 실시간 가격 이력 기능이 정상 동작합니다.

필수:

```txt
ITAD_API_KEY=본인 IsThereAnyDeal API Key
ITAD_COUNTRY=KR
STEAM_COUNTRY=kr
STEAM_LANGUAGE=korean
```

선택:

```txt
STEAM_SPECIALS_LIMIT=400
STEAM_SEARCH_PAGE_SIZE=100
STEAM_APPDETAILS_BATCH_SIZE=25
STEAM_APPDETAILS_CONCURRENCY=4
ITAD_BATCH_SIZE=100
ITAD_HISTORY_LIMIT=60
ITAD_HISTORY_CONCURRENCY=4
API_TIMEOUT_MS=8000
```

트래픽이나 함수 실행 시간이 부담되면 `STEAM_SPECIALS_LIMIT`을 `250` 정도로 낮추면 됩니다.

## Vercel 배포

1. Vercel에서 `Add New Project`
2. GitHub 저장소 `Haran1426/SteamSaleMap` 선택
3. Framework Preset은 `Other`
4. Root Directory는 `./`
5. Build Command와 Output Directory는 비워둠
6. Environment Variables에 필수 환경변수 4개 추가
7. Deploy

`vercel.json`에서 `api/live-games.js` 함수의 `maxDuration`을 30초로 설정했습니다.

## 로컬 실행

정적 화면만 확인:

```bash
python -m http.server 5173 --bind 127.0.0.1
```

접속:

```txt
http://127.0.0.1:5173
```

Netlify 함수까지 로컬로 확인:

```bash
npm install
npm run dev
```

## 주요 파일

```txt
index.html                         화면 구조
style.css                          반응형 UI, 카드, 모달, 스크롤바 스타일
main.js                            데이터 로드, 필터, 정렬, 모달, CSV export
games.json                         직접 큐레이션한 기본 게임 데이터
netlify/functions/live-games.js    Steam/ITAD API 병합 함수
api/live-games.js                  Vercel용 API 래퍼
netlify.toml                       Netlify 함수 패키징 설정
vercel.json                        Vercel 함수 실행 시간 설정
package.json                       개발 스크립트
```

## 데이터 흐름

1. 프론트가 실시간 API를 호출합니다.
2. 서버리스 함수가 Steam featured categories와 Steam 할인 검색 결과를 가져옵니다.
3. `games.json`의 큐레이션 데이터와 Steam 실시간 할인 목록을 병합합니다.
4. Steam appdetails를 배치 호출해 현재가, 정가, 할인율, 설명, 이미지를 보강합니다.
5. `ITAD_API_KEY`가 있으면 ITAD에서 게임 ID, 역대 최저가, 최근 가격 이력을 가져옵니다.
6. 프론트에서 할인율, 최저가 차이, 종료일, 태그를 기반으로 추천 점수를 계산합니다.
7. API 실패 시 `games.json` 샘플 데이터로 fallback합니다.

## 최근 수정 내역

- Netlify 사용량 제한 발생 후 Vercel 배포 구조 추가
- Vercel `/api/live-games` fallback 추가
- Steam 할인 검색 결과를 페이지 단위로 수집해 게임 수를 약 400개까지 확장
- Steam appdetails 호출을 배치 처리로 변경
- ITAD lookup/storelow 요청을 100개 단위로 분할
- ITAD 가격 이력 API의 `since` 날짜 형식 수정
- ITAD 가격 금액을 원화 기준으로 올바르게 표시하도록 수정
- 가격 이력이 부족한 게임에 현재가/역대 최저가 스냅샷 표시
- 상세 모달 설명을 Steam `short_description` 기반으로 표시

## 포트폴리오 어필 포인트

- 단순 정적 페이지가 아니라 외부 API와 자체 큐레이션 데이터를 병합하는 대시보드
- 서버리스 함수에서 Steam/ITAD 데이터를 수집, 정규화, 병합
- API 실패 시 샘플 데이터로 전환하는 fallback 구조
- 가격 이력/최저가 기반 추천 로직
- 검색, 필터, 정렬, 상세 모달, CSV export 등 운영형 UI 구성
- Netlify 제한 이슈를 Vercel 이전과 함수 fallback 구조로 해결한 배포 대응 경험

## 다음 개선 후보

- 가격 이력 차트 시각화
- 추천 점수 계산 로직 단위 테스트
- Steam/ITAD API rate-limit 대응 강화
- 서버 응답 캐시 정책 고도화
- Odoo Product/Price List 형식 CSV export 확장
- 필터 옵션을 Steam 태그/장르 데이터 기반으로 더 정교하게 분류
