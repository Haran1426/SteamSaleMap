# 겜세일러 - Steam 할인 게임 추천 사이트

정적 웹사이트 형태의 스팀 할인 게임 추천 프로젝트입니다.

## 포함 파일

- index.html
- style.css
- main.js
- games.json

## 주요 기능

- 게임 검색
- 장르 필터
- 싱글/협동/멀티 필터
- 사양 필터
- 할인율/가격/추천순 정렬
- 할인 주기 계산
- 역대 최저가 차이 계산
- 구매 판단 표시
- 게임 상세 모달
- Steam 상점 이동

## 실행 방법

VS Code에서 Live Server로 index.html을 열면 됩니다.

그냥 파일 더블클릭으로도 대부분 보이지만, games.json을 불러오려면 Live Server 방식이 더 안전합니다.

## 다음 단계

1. games.json에 게임 추가
2. 광고 코드 삽입
3. Firebase Analytics 추가
4. Netlify/Firebase Hosting/GitHub Pages 배포
5. 가격 자동 갱신용 서버리스 함수 추가
