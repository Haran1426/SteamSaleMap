# 겜세일러 Live

샘플 가격을 박아둔 버전이 아니라, 서버 함수에서 실시간 가격을 가져오는 버전입니다.

## 실행

```bash
npm install
npm run dev
```

접속:

```txt
http://localhost:8888
```

## 배포

Netlify에 그대로 올리면 됩니다.

## 환경 변수

Steam 현재 가격만 볼 경우 환경 변수 없이 동작합니다.

할인 주기, 역대 최저가까지 보려면 Netlify 환경 변수에 추가하세요.

```txt
ITAD_API_KEY=본인 IsThereAnyDeal API 키
ITAD_COUNTRY=KR
STEAM_COUNTRY=kr
STEAM_LANGUAGE=korean
```

## 구조

```txt
index.html
style.css
main.js
games.json
netlify/functions/live-games.js
netlify.toml
package.json
```

## 데이터 방식

- games.json: 게임 선정, 태그, 사양, 설명만 저장
- Steam Store: 현재 가격, 정가, 할인율, 할인 종료일 실시간 조회
- IsThereAnyDeal: API 키가 있으면 역대 최저가와 가격 기록 조회
- Cache-Control: 1시간 캐시
