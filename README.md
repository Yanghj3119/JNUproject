# 제주픽 — 사진으로 만나는 제주 (관광객용 사진 명소 갤러리)

Vite + React + Router + Zustand + Bootstrap + Supabase + Three.js

## 실행
```bash
npm install
cp .env.example .env.local     # Windows: copy .env.example .env.local  → 값 채우기
npm run dev                    # http://localhost:5173  (화면 + /api 서버 함수 모두 동작)
```
배포(Vercel)에서는 `api/` 폴더가 서버 함수로 실행됩니다. 환경변수는 Vercel 프로젝트 설정에 같은 이름으로 등록하세요.

## 환경변수 (.env.local)
| 이름 | 용도 |
|---|---|
| `DATA_GO_KR_KEY` | 공공데이터포털 인증키 (Decoding 키). 활용신청이 승인된 모든 API에 공통 |
| `ANTHROPIC_API_KEY` | AI 가이드 (강사 제공 키) |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase (보관함·대화기록). anon/publishable 키만 사용 (service_role 금지) |
| `VITE_KAKAO_MAP_KEY` | 카카오맵 JavaScript 키 (선택). 카카오 디벨로퍼스 → 앱 → 플랫폼 → Web 에 `http://localhost:5173` 과 배포 주소 등록 |

Supabase 는 `supabase/schema.sql` 을 SQL Editor 에서 실행해 테이블을 만드세요.
키 점검은 앱의 **/status (연결 상태)** 페이지에서 할 수 있습니다.

## 사용하는 공공데이터 API
| 기능 | API | 파일 |
|---|---|---|
| `search_photos`, `get_photo_info` | 한국관광공사 관광사진 정보_GW | `server/photos.js` |
| `find_nearby`, 장소 목록·상세 | 한국관광공사 국문 관광정보 서비스_GW | `server/tour.js` |
| `get_weather` | 기상청 단기예보 조회서비스 | `server/weather.js` |
| `check_accessibility` | 한국관광공사 무장애 여행 정보 | `server/access.js` |
| `get_related_places` | 한국관광공사 관광지별 연관 관광지 정보 | `server/related.js` |
| 사진 보강 | 한국관광공사 관광공모전(사진) 수상작 정보 | `server/photos.js` |
| `get_crowd_forecast` | 한국관광공사 관광지 집중률 방문자 추이 예측 | `server/crowd.js` |
| 일출·일몰 | 한국천문연구원 출몰시각 정보 | `server/sun.js` |

### 제주데이터허브 (`server/hub.js`, 키: `JEJU_DATAHUB_KEY`)
호출 형식 `https://open.jejudatahub.net/api/proxy/{API 고유 ID}/{프로젝트 키}?변수=값`. 프로젝트 키는 제주데이터허브 마이페이지에서 프로젝트를 만들고 신청한 API 를 담으면 발급됩니다.

| 용도 | API | 화면 |
|---|---|---|
| 오름·박물관/미술관·기념품 위치 | 오름 위치 정보 외 2종 | 지도 페이지 핀 + AI 도구 `search_jeju_places` |
| 한라산 둘레길 | 한라산 둘레길 코스별 정보 | 여행 정보 탭 + `get_hallasan_trails` |
| 교통사고 다발지역 | 교통사고 다발지역 정보 | 여행 정보 탭 + `get_traffic_accident_spots` |
| 버스 정류소 | 버스 정류소 기본 정보 | 여행 정보 탭 + `search_bus_stops` |
| 숙박 | 관광 숙박업 정보 | 여행 정보 탭 + `search_lodging` |

`/api/photos?debug=1` 로 사진 API 원본 응답(필드명·촬영월 형식)을 확인할 수 있습니다.

> `server/photos.js`, `server/related.js` 의 일부 파라미터·필드명은 활용가이드로 실제 호출해 확인이 필요합니다. (/status 에서 실패하면 해당 파일 상단 주석 참고)

## 3D 지도 데이터 (키 불필요)
실제 지형을 브라우저에서 합성합니다 (`src/lib/terrain.js`).
- 고도: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Terrarium, Mapzen)
- 위성사진: [Sentinel-2 cloudless 2020](https://s2maps.eu) © EOX IT Services GmbH — Contains modified Copernicus Sentinel data 2020, **CC BY-NC-SA 4.0 (비영리·출처 표기 필수)**. 상업적 서비스로 쓰려면 EOX 라이선스를 별도로 받아야 합니다.
- 타일을 못 받으면 단순화된 3D 섬(`JejuStylized.jsx`)으로 자동 대체됩니다.

## 이미지
`public/images/` 의 사진 8장(홈 히어로·테마 카드·페이지 배너·로그인·404)은 Pixabay 무료 이미지(Pixabay 콘텐츠 라이선스)를 웹용(가로 1800px, JPEG)으로 줄인 것입니다.

## 지도 핀
공공데이터가 비어 있거나 실패하면 `src/data/landmarks.js` 의 제주 대표 명소(관광지 24곳·오름 9곳)를 대신 표시합니다. 핀 색은 푸른 계열이며(`src/lib/format.js` 의 `TYPE_META`), 3D 핀은 `src/components/Jeju3D.jsx` 의 `Pins` 에서 애니메이션합니다.

## 구조
```
api/        Vercel 서버 함수 (/api/파일이름) — 얇은 껍데기, server/ 함수를 호출
server/     공공데이터 호출 함수 + tools.js (AI 에이전트 도구) — 화면·에이전트가 같은 함수를 공유
src/
  main.jsx, router.jsx   테마 + 메뉴·주소
  layouts/               공통 틀 (메뉴·푸터·알림)
  store/useAppStore.js   닉네임·알림·보관함·AI 대화
  api/client.js          화면 → /api 호출
  components/            PhotoCard, PlaceCard, WeatherBadge, Jeju3D ...
  pages/                 Home, Explore, PhotoDetail, Map3D, Agent, My, StatusPage
supabase/schema.sql      favorites, chat_logs 테이블
```
