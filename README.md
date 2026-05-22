# GameSailor

Steam 할인 게임을 수집하고, 현재가/할인율/가격 이력/추천 점수 기준으로 정렬하는 포트폴리오용 대시보드입니다. ECODOOBIZ 지원용으로 외부 API 연동, 서버리스 함수, 데이터 fallback, 필터/정렬 UI를 보여주기 위해 만든 프로젝트입니다.

## 현재 상태

- GitHub 저장소: `https://github.com/Haran1426/SteamSaleMap`
- 기존 Netlify 주소: `https://steam-sale-map.netlify.app/`
- 현재 Netlify 상태: 사용량 제한(`usage_exceeded`)으로 일시 차단됨
- 마지막으로 확인한 정상 기능:
  - Steam 실시간 할인 목록 수집
  - IsThereAnyDeal(ITAD) 게임 ID 매칭
  - 일부 게임의 최근 가격 이력 표시
  - Steam 설명/이미지 기반 상세 모달
  - Vercel용 API fallback 추가 완료

Netlify 주소가 막혀 있으면 코드 문제가 아니라 Netlify 플랜/사용량 제한 문제입니다. 당장 포트폴리오 링크가 필요하면 Vercel로 새로 배포하는 것이 빠릅니다.

## 배포 권장: Vercel

이 저장소는 Netlify Functions와 Vercel Serverless Functions를 모두 지원합니다.

Vercel에서 이어서 배포하는 순서:

1. Vercel에 로그인
2. `Add New Project`
3. GitHub 저장소 `Haran1426/SteamSaleMap` 선택
4. Framework Preset은 `Other` 또는 자동 감지 그대로 사용
5. Build Command는 비워두거나 기본값 사용
6. Output Directory도 비워둠
7. Environment Variables에 아래 값 추가
8. Deploy

필수 환경변수:

```txt
ITAD_API_KEY=본인 IsThereAnyDeal API 키
ITAD_COUNTRY=KR
STEAM_COUNTRY=kr
STEAM_LANGUAGE=korean
```

선택 환경변수:

```txt
STEAM_SPECIALS_LIMIT=40
ITAD_HISTORY_LIMIT=16
ITAD_HISTORY_CONCURRENCY=4
API_TIMEOUT_MS=8000
```

Vercel 배포 후 프론트는 `/api/live-games`를 통해 실시간 데이터를 가져옵니다. Netlify에서 실행될 때는 `/.netlify/functions/live-games`를 먼저 시도하고, 실패하면 `/api/live-games`를 시도합니다.

## 로컬 실행

정적 화면만 확인:

```bash
python -m http.server 5173 --bind 127.0.0.1
```

접속:

```txt
http://127.0.0.1:5173
```

Netlify 함수까지 로컬로 확인하려면:

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
package.json                       개발 스크립트
```

## 데이터 흐름

1. 프론트가 실시간 API를 호출합니다.
2. 서버리스 함수가 Steam featured categories와 Steam appdetails를 호출합니다.
3. `games.json`의 큐레이션 데이터와 Steam 실시간 할인 목록을 병합합니다.
4. `ITAD_API_KEY`가 있으면 ITAD에서 게임 ID, 역대 최저가, 최근 가격 이력을 가져옵니다.
5. 프론트에서 할인율, 최저가 차이, 종료일, 태그를 기반으로 추천 점수를 계산/표시합니다.
6. API 실패 시 `games.json` 샘플 데이터로 fallback합니다.

## 최근 수정 내역

- Netlify 함수에서 `games.json`을 읽지 못하던 문제 수정
- ITAD Steam app lookup ID 형식을 `app/{steamAppId}`로 수정
- ITAD 가격 이력 API의 `since` 날짜 형식 수정
- ITAD 가격 금액을 원화 기준으로 올바르게 표시하도록 수정
- 상세 모달 설명을 Steam `short_description` 기반으로 표시
- 가격 이력이 없는 게임의 안내 문구 수정
- Netlify 사용량 초과에 대비해 Vercel `/api/live-games` fallback 추가

## 포트폴리오 어필 포인트

- 단순 정적 페이지가 아니라 외부 API와 자체 큐레이션 데이터를 병합하는 대시보드
- Steam API 실패 시 샘플 데이터로 전환하는 fallback 구조
- ITAD API를 이용한 가격 이력/최저가 기반 추천 로직
- 필터, 검색, 정렬, 상세 모달, CSV export 등 운영형 UI 구성
- Netlify와 Vercel 양쪽 서버리스 환경을 고려한 배포 구조

## 다음 개선 후보

- 가격 이력 차트 시각화
- 추천 점수 계산 로직 단위 테스트
- Steam/ITAD API rate-limit 대응 강화
- Odoo Product/Price List 형식으로 CSV export 확장
- Netlify 사용량 제한 회피를 위한 Vercel/Cloudflare Pages 배포 안정화
