# 제주픽(JEJU-PICK) — 사진 명소에서 시작하는 제주 여행 코스 · AI 가이드

사진 명소·포토존·유명 관광지를 바탕으로 AI가 코스를 추천하고, 길찾기·날씨·교통·숙박 같은 여행 편의 정보를 한곳에서 보여 주는 관광객용 웹 서비스입니다.
운영 주소: https://jn-uproject.vercel.app

Vite + React + Router + Zustand + Bootstrap + Supabase + Three.js (배포: Vercel Hobby, 서버 함수 `api/` 11개)

## 주요 기능
| 메뉴 | 내용 |
|---|---|
| 홈 | AI 질문 입력(음성 입력 지원), 테마 카드, 오늘의 제주 풍경 |
| AI 가이드 (`/agent`) | 공공데이터 도구 15종을 직접 호출해 코스를 만들고, 지도·경로(도로/도보)·공유 링크로 보여 줌 |
| 사진 탐색 (`/explore`) | 한국관광공사 관광사진 갤러리 |
| 포토 스팟 (`/spots`) | 테마별 명소 + 카카오맵 핀, **여행자 사진**(사용자 업로드), 사진 속 장소를 기준으로 한 AI 코스 |
| 내 주변 (`/near`) | 내 위치(또는 직접 입력한 위치) 기준 주변 명소·정류장 |
| 미니앨범 (`/album`) | 내 사진으로 앨범 PPT 만들기 (아래 설명) |
| 지도 (`/map`) | 실제 지형 3D 지도(오름·둘레길·올레길·내 위치) |
| 여행 정보 (`/info`) | 대중교통(버스 위치·노선) · 공항 · 선박(항구 지도) · 렌터카 · 올레길·둘레길(3D) · 숙박(지도+상세) |
| 내 보관함 (`/my`) | 위시리스트(선택해 AI 코스 만들기) · 내 경로 · 내 사진(업로드 삭제) |

### 미니앨범
- 사진 최대 5장 → 앨범형 4종(폴라로이드·필름·스크랩북·갤러리 액자) / 미니멀 2종(화이트·블랙) 템플릿. 사진 색감에 따라 앨범형을 자동 추천하고 직접 바꿀 수 있음.
- 사진을 자르지 않는 레이아웃(세로 사진 두 장은 한 페이지에 나란히), 웹폰트(Nanum Myeongjo·Nanum Pen Script·Pretendard), 사진 EXIF의 촬영 날짜·장소(읍·면·동까지, 카카오 지오코더) 자동 기재.
- AI(`/api/album`, Haiku): 제목·부제·장면별 문구, 어조 선택(감성/담백/재치/영어), 추천 사진 순서, 사진 품질(어두움·흐림) 경고.
- 슬라이드쇼는 장당 1.5초 자동 재생, 내려받는 PPT에도 1.5초 자동 넘김 + 페이드 전환이 들어감.
- **프라이버시**: 사진은 브라우저 안에서만 처리하고 서버·Supabase에 저장하지 않음. AI 문구를 만들 때만 줄인 사진이 전달됨. "모두 삭제", 15분 미사용, 창 닫기 시 즉시 삭제. 공개 포토 스팟 업로드는 별도 기능(`/spots/upload`, 1인 5장, 본인만 삭제).

### 모바일 화면
767px 이하에서 스크롤을 줄이도록 사진 카드 2열, 가로 스와이프 카드·칩, 포토 스팟 지도 상단 배치와 "더 보기", 배너·푸터 축소를 적용했습니다 (`src/styles/theme.css` 맨 아래, `src/lib/useIsMobile.js`). 데스크톱 화면은 그대로입니다.

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
| `ANTHROPIC_API_KEY` | AI 가이드·미니앨범 문구 (강사 제공 키, 서버 전용) |
| `AGENT_MODEL` (선택) | 에이전트 모델. 기본 `claude-haiku-5-5`. 미니앨범은 `ALBUM_MODEL` 로 따로 지정 가능 (테스트 단계라 Haiku 고정) |
| `JEJU_DATAHUB_KEY` | 제주데이터허브 프로젝트 키 (오름·둘레길·버스·공항·선박·숙박·렌터카) |
| `KAKAO_REST_KEY` (선택) | 카카오 장소 검색(서버 전용). AI가 유명 장소를 정확히 찾도록 도움 |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase (보관함·대화기록). anon/publishable 키만 사용 (service_role 금지) |
| `VITE_KAKAO_MAP_KEY` | 카카오맵 JavaScript 키 (선택). 카카오 디벨로퍼스 → 앱 → 플랫폼 → Web 에 `http://localhost:5173` 과 배포 주소 등록 |

Supabase 는 `supabase/schema.sql`(favorites·routes·chat_logs)과 `supabase/user_spots.sql`(여행자 사진 테이블 + `user-spots` 저장소, RLS, 1인 5장 제한)을 SQL Editor 에서 실행하세요.
**보안 원칙**: 키는 `.env.local`/Vercel 환경변수에만 두고, 서버 키에는 `VITE_` 를 붙이지 않으며, Supabase 는 anon/publishable 키만 씁니다. `.env.example` 에는 값을 넣지 않습니다. 푸시 전 변경분에서 키 패턴을 검사합니다.
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

### 그 밖의 외부 데이터 (키 불필요)
| 용도 | 출처 |
|---|---|
| 한라산 둘레길·올레길 경로선 | OpenStreetMap(Overpass)에서 받아 `public/data/*.json` 에 구워 둠 (올레 9개 코스. 두루누비 API에는 제주 코스가 없음) |
| 도로·도보 길찾기 | OSRM 공개 서버 (`src/lib/routing.js`, 브라우저에서 호출) |
| 촬영 위치 → 주소 | 카카오 지오코더 (`src/lib/kakaoGeo.js`) |

### 제주데이터허브 (`server/hub.js`, 키: `JEJU_DATAHUB_KEY`)
호출 형식 `https://open.jejudatahub.net/api/proxy/{API 고유 ID}/{프로젝트 키}?변수=값`. 프로젝트 키는 제주데이터허브 마이페이지에서 프로젝트를 만들고 신청한 API 를 담으면 발급됩니다.

| 용도 | API | 화면 |
|---|---|---|
| 오름·박물관/미술관·기념품 위치 | 오름 위치 정보 외 2종 | 지도 페이지 핀 + AI 도구 `search_jeju_places` |
| 한라산 둘레길 | 한라산 둘레길 코스별 정보 | 여행 정보 탭 + `get_hallasan_trails` |
| 버스 도착·위치·정류소 | 국토교통부 TAGO (제주 도시코드 39) | 여행 정보 > 대중교통 + `get_bus_arrivals` |
| 공항 운항 스케줄 | 한국공항공사 국내선 운항 스케줄 | 여행 정보 > 공항 + `get_flight_schedule` |
| 숙박 | 관광 숙박업 정보 | 여행 정보 > 숙박(지도·전화·홈페이지) + `search_lodging` |
| 선박 | 제주 여객선 운항 정보 | 여행 정보 > 선박(항구 지도) + `get_ferry_schedule` |
| 렌터카·쏘카존 | 렌터카 업체 / 쏘카존 위치 | 여행 정보 > 렌터카 + `search_jeju_places` |

`/api/photos?debug=1` 로 사진 API 원본 응답(필드명·촬영월 형식)을 확인할 수 있습니다.

> `server/photos.js`, `server/related.js` 의 일부 파라미터·필드명은 활용가이드로 실제 호출해 확인이 필요합니다. (/status 에서 실패하면 해당 파일 상단 주석 참고)

## 3D 지도 데이터 (키 불필요)
실제 지형을 브라우저에서 합성합니다 (`src/lib/terrain.js`).
- 고도: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Terrarium, Mapzen)
- 위성사진: [Sentinel-2 cloudless 2020](https://s2maps.eu) © EOX IT Services GmbH — Contains modified Copernicus Sentinel data 2020, **CC BY-NC-SA 4.0 (비영리·출처 표기 필수)**. 상업적 서비스로 쓰려면 EOX 라이선스를 별도로 받아야 합니다.
- 타일을 못 받으면 단순화된 3D 섬(`JejuStylized.jsx`)으로 자동 대체됩니다.

## 카카오 로그인 · 링크 공유
- **공유**: 코스 공유 링크(`/share?d=…`)는 코스 정보가 주소에 들어 있어 서버 저장 없이 누구나 열 수 있습니다. 카카오톡 공유는 지도와 같은 JavaScript 키(`VITE_KAKAO_MAP_KEY`)를 쓰며, 카카오 앱의 **JavaScript SDK 도메인**에 사이트 주소가 등록돼 있어야 합니다. 키가 없으면 기기 공유창 → 링크 복사로 대체됩니다.
- **카카오 로그인** (Supabase Auth 의 Kakao provider):
  1. 카카오 디벨로퍼스 → 제품 설정 → **카카오 로그인** ON, Redirect URI 에 `https://<프로젝트>.supabase.co/auth/v1/callback` 등록
  2. 카카오 로그인 → 보안 → **Client Secret** 발급·활성화, 동의항목에서 닉네임 등 설정 (이메일은 비즈 앱이어야 받을 수 있음)
  3. Supabase → Authentication → Sign In / Providers → **Kakao** 활성화, 카카오 **REST API 키**(Client ID)와 Client Secret 입력
  4. Supabase → Authentication → URL Configuration 의 Site URL / Redirect URLs 에 배포 주소와 `http://localhost:5173` 추가

## 이미지
`public/images/` 의 사진 8장(홈 히어로·테마 카드·페이지 배너·로그인·404)은 Pixabay 무료 이미지(Pixabay 콘텐츠 라이선스)를 웹용(가로 1800px, JPEG)으로 줄인 것입니다.

## 지도 핀
공공데이터가 비어 있거나 실패하면 `src/data/landmarks.js` 의 제주 대표 명소(관광지 24곳·오름 9곳)를 대신 표시합니다. 핀 색은 푸른 계열이며(`src/lib/format.js` 의 `TYPE_META`), 3D 핀은 `src/components/Jeju3D.jsx` 의 `Pins` 에서 애니메이션합니다.

## 구조
```
api/        Vercel 서버 함수 (/api/파일이름, 11개) — 얇은 껍데기, server/ 함수를 호출. album.js 는 미니앨범 AI 문구
server/     공공데이터 호출 함수 + tools.js (AI 에이전트 도구) — 화면·에이전트가 같은 함수를 공유
src/
  main.jsx, router.jsx   테마 + 메뉴·주소
  layouts/               공통 틀 (메뉴·푸터·알림)
  store/useAppStore.js   닉네임·알림·보관함·AI 대화
  api/client.js          화면 → /api 호출
  components/            PhotoCard, PlaceCard, WeatherBadge, Jeju3D ...
  pages/                 Home, Explore, PhotoDetail, PhotoSpots, SpotUpload, Near, Album, Map3D, Info, Agent, My, StatusPage
  lib/                   albumRender(캔버스 페이지 그리기), albumTools(템플릿·PPT·EXIF), kakaoGeo, routing, userSpots ...
public/data/             둘레길·올레길·숙박 JSON
supabase/                schema.sql, user_spots.sql, migrate_auth.sql
```

## 알려진 한계
- AI 기능(에이전트·미니앨범 문구)은 `ANTHROPIC_API_KEY` 가 있는 운영 서버에서만 테스트됩니다 (로컬에는 키가 없음).
- 올레길 전체 GPX는 공식 데이터를 구할 수 없어 일부 코스만 경로로, 나머지는 시작·끝 지점만 표시합니다.
- 미니앨범 PPT의 자동 넘김은 PowerPoint 슬라이드쇼에서 동작합니다 (뷰어에 따라 다를 수 있음).
- 서버 함수는 Vercel Hobby 제한(12개)에 맞춰 11개로 유지합니다. 새 기능은 기존 함수에 합쳐 주세요.
