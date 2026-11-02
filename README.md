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
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase (보관함·대화기록) |

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

> `server/photos.js`, `server/related.js` 의 일부 파라미터·필드명은 활용가이드로 실제 호출해 확인이 필요합니다. (/status 에서 실패하면 해당 파일 상단 주석 참고)

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
