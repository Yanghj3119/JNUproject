# 제주픽 (JEJU-PICK)

> **인생샷 한 장에서 시작해 제주 하루 코스가 됩니다.**
> 사진 명소·포토존·유명 관광지를 바탕으로 AI가 코스를 추천하고, 길찾기·날씨·교통·숙박 같은 여행 편의 정보를 한곳에서 보여 주는 관광객용 웹 서비스입니다.

- 운영 주소: https://jn-uproject.vercel.app
- 발표 자료: [`docs/제주픽-발표.pptx`](docs/제주픽-발표.pptx) (3분 발표용 8장: 페이지별 기능·AI 도구 15종·데이터 출처 중심, 슬라이드마다 발표 대본이 노트에 들어 있음)
- 기술: Vite · React · React Router · Zustand · Bootstrap · Supabase · Three.js · Kakao Maps — 배포는 Vercel Hobby(서버 함수 `api/` 11개)

## 목차
1. [주요 기능](#주요-기능)
2. [AI 구조와 비용 관리](#ai-구조와-비용-관리)
3. [사진 편집과 미니앨범](#사진-편집과-미니앨범)
4. [모바일 화면](#모바일-화면)
5. [실행과 배포](#실행과-배포)
6. [환경변수와 Supabase](#환경변수와-supabase)
7. [사용하는 데이터](#사용하는-데이터)
8. [카카오 로그인·공유](#카카오-로그인--링크-공유)
9. [프로젝트 구조](#프로젝트-구조)
10. [알려진 한계](#알려진-한계)

## 주요 기능
| 메뉴 | 내용 |
|---|---|
| 홈 | AI 질문 입력(음성 입력 지원), 테마 카드, 오늘의 제주 풍경 |
| AI 가이드 (`/agent`) | 공공데이터 도구 15종을 직접 호출해 코스를 만들고, 지도·경로(도로/도보)·공유 링크로 보여 줌 |
| 사진 탐색 (`/explore`) | 한국관광공사 관광사진 갤러리 |
| 포토 스팟 (`/spots`) | 테마별 명소 + 카카오맵 핀, **여행자 사진**(사용자 업로드), 사진이 찍힌 곳을 기준으로 한 AI 코스 |
| 내 주변 (`/near`) | 내 위치(또는 직접 입력한 위치) 기준 주변 명소·정류장 |
| 사진 편집 (`/album`) | 내 사진 최대 5장을 슬라이더·필터·자르기·**말(AI 채팅)** 로 다듬어 저장, 원하면 앨범 PPT·MP4 영상으로 만들기 |
| 지도 (`/map`) | 실제 지형 3D 지도(오름·둘레길·올레길·내 위치) |
| 여행 정보 (`/info`) | 대중교통(버스 위치·노선) · 공항 · 선박(항구 지도) · 렌터카 · 올레길 26코스·한라산 둘레길(3D) · 숙박(지도+상세) |
| 내 보관함 (`/my`) | 위시리스트(선택해 AI 코스 만들기) · 내 경로 · 내 사진(업로드 삭제) |

## AI 구조와 비용 관리
- **에이전트(`api/agent.js`)**: 기본 모델 `claude-haiku-5-5`(환경변수 `AGENT_MODEL`로 변경). 질문에 맞는 도구(`server/tools.js`, 15종: 사진·날씨·혼잡도·접근성·주변 검색·버스·공항·선박·숙박·둘레길 등)를 스스로 골라 호출하고, 방문 순서와 좌표가 있는 코스(`propose_route`)로 답합니다.
- **AI는 "해석"만, 실제 작업은 코드가**: 사진 편집에서 AI는 편집 명령(JSON)만 돌려주고, 보정은 브라우저가 합니다. 이미지를 AI에게 만들게 하지 않아 토큰이 적게 듭니다.
- **쉬운 말은 AI를 거치지 않음**: "밝게·흑백·정사각형·필름 느낌" 같은 자주 쓰는 요청과 예시 버튼은 코드가 해석합니다(토큰 0). 사진의 특정 부분(하늘·배경·사람 등)을 지목한 요청만 AI로 넘어갑니다.
- **사용량 제한**: 사진 편집의 AI 해석은 로그인 필요, **1인 하루 10회 · 전체 하루 500회**(한국 시간 기준). 횟수는 Supabase 함수가 세며 service_role 키는 쓰지 않습니다(`supabase/ai_usage.sql`). 한도를 넘어도 슬라이더·필터는 계속 쓸 수 있습니다.
- 미니앨범 문구 AI는 IP당 10분에 8번(서버 메모리 기준)으로 제한합니다. 모델은 테스트 단계라 Haiku로 고정(`ALBUM_MODEL`로만 변경).

## 사진 편집과 미니앨범
### 사진 편집 (AI 채팅)
- 슬라이더(밝기·대비·채도·따뜻함·가장자리 어둡게), 필터(흑백·세피아·빈티지·페이드), 자르기(1:1·4:5·3:4·16:9·9:16), 회전·좌우 반전, 되돌리기·원본으로 — **모두 무제한**이고 원본에서 매번 새로 그려 화질이 떨어지지 않습니다(`src/lib/photoEdit.js`, `src/components/PhotoEditor.jsx`).
- 채팅창에 "하늘을 더 파랗게"처럼 적으면 AI가 편집 명령으로 바꿔 적용합니다. 못 하는 것: 배경 바꾸기·물체 지우기·얼굴 보정(이미지 생성 모델이 필요).
- 채팅에는 "AI 없이 처리"인지 "AI 사용 · 오늘 N회 남음"인지 표시됩니다.

### 앨범·영상으로 내보내기
- 앨범형 4종(폴라로이드·필름·스크랩북·갤러리 액자) / 미니멀 2종(화이트·블랙) 템플릿. 사진 색감에 따라 앨범형을 자동 추천하고 직접 바꿀 수 있습니다.
- 사진을 자르지 않는 레이아웃(세로 사진 두 장은 한 페이지에 나란히), 웹폰트(Nanum Myeongjo·Nanum Pen Script·Pretendard), 사진 EXIF의 촬영 날짜·장소(읍·면·동까지, 카카오 지오코더) 자동 기재.
- AI(`/api/album`, Haiku): 제목·부제·장면별 문구, 어조 선택(감성/담백/재치/영어), 추천 사진 순서, 품질(어두움·흐림) 경고.
- **PPT**: 장당 1.5초 자동 넘김 + 페이드 전환. **MP4 영상**(`src/lib/albumVideo.js`): WebCodecs(H.264) + mp4-muxer로 브라우저에서 만들며(AI·서버 사용 없음, 토큰 0) 휴대폰 갤러리에서 바로 재생됩니다. 최신 크롬·엣지·사파리에서 지원하며, 지원하지 않는 기기에서는 영상 버튼이 보이지 않습니다.
- **프라이버시**: 사진은 브라우저 안에서만 처리하고 서버·Supabase에 저장하지 않습니다. AI를 요청할 때만 요청 문장(과 줄인 사진 한 장)이 전달됩니다. "모두 삭제", 15분 미사용, 창 닫기 시 즉시 삭제됩니다. 공개 포토 스팟 업로드는 별도 기능입니다(`/spots/upload`, 1인 5장, 본인만 삭제).

## 모바일 화면
767px 이하에서 스크롤을 줄이도록 사진 카드 2열, 가로 스와이프 카드·칩, 포토 스팟의 지도 상단 배치와 "더 보기"(12곳씩), 배너·푸터 축소를 적용했습니다(`src/styles/theme.css` 맨 아래, `src/lib/useIsMobile.js`). 데스크톱 화면은 그대로입니다.
측정 결과(375px 폭, 페이지 길이): 포토 스팟 약 24,900px → 2,560px, 홈 약 7,460px → 2,600px, 사진 탐색 약 7,030px → 2,650px.

## 실행과 배포
```bash
npm install
cp .env.example .env.local     # Windows: copy .env.example .env.local  → 값 채우기
npm run dev                    # http://localhost:5173  (화면 + /api 서버 함수 모두 동작)
```
배포(Vercel)에서는 `api/` 폴더가 서버 함수로 실행됩니다. 환경변수는 Vercel 프로젝트 설정에 같은 이름으로 등록하세요. 로컬에는 `ANTHROPIC_API_KEY`가 없을 수 있어 AI 기능은 운영 서버에서 확인합니다.

## 환경변수와 Supabase
| 이름 | 용도 |
|---|---|
| `DATA_GO_KR_KEY` | 공공데이터포털 인증키 (Decoding 키). 활용신청이 승인된 모든 API에 공통 |
| `ANTHROPIC_API_KEY` | AI 가이드·사진 편집·미니앨범 문구 (서버 전용) |
| `AGENT_MODEL` (선택) | 에이전트 모델. 기본 `claude-haiku-5-5`. 미니앨범은 `ALBUM_MODEL`로 따로 지정 가능 |
| `JEJU_DATAHUB_KEY` | 제주데이터허브 프로젝트 키 (오름·둘레길·올레길·버스·공항·선박·숙박·렌터카) |
| `KAKAO_REST_KEY` (선택) | 카카오 장소 검색(서버 전용). AI가 유명 장소를 정확히 찾도록 도움 |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase (보관함·대화기록·사용량 제한). anon/publishable 키만 사용 (service_role 금지) |
| `VITE_KAKAO_MAP_KEY` | 카카오맵 JavaScript 키 (선택). 카카오 디벨로퍼스 → 앱 → 플랫폼 → Web 에 `http://localhost:5173` 과 배포 주소 등록 |

Supabase SQL Editor에서 아래 파일을 실행하세요(여러 번 실행해도 안전합니다).
| 파일 | 내용 |
|---|---|
| `supabase/schema.sql` | favorites · routes · chat_logs |
| `supabase/user_spots.sql` | 여행자 사진 테이블 + `user-spots` 저장소, RLS, 1인 5장 제한 |
| `supabase/ai_usage.sql` | AI 편집 사용량(`use_ai_edit`, `ai_edit_left`): 1인 하루 10회 · 전체 하루 500회. 실행 전에는 AI 해석만 "준비 중"으로 보임 |

**보안 원칙**: 키는 `.env.local`/Vercel 환경변수에만 두고, 서버 키에는 `VITE_`를 붙이지 않으며, Supabase는 anon/publishable 키만 씁니다. `.env.example`에는 값을 넣지 않고, 푸시 전 변경분에서 키 패턴을 검사합니다. 키 점검은 앱의 **/status (연결 상태)** 페이지에서 할 수 있습니다.

## 사용하는 데이터
### 공공데이터포털
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
호출 형식 `https://open.jejudatahub.net/api/proxy/{API 고유 ID}/{프로젝트 키}?변수=값`. 프로젝트 키는 마이페이지에서 프로젝트를 만들고 신청한 API를 담으면 발급됩니다.

| 용도 | API | 화면 |
|---|---|---|
| 오름·박물관/미술관·기념품 위치 | 오름 위치 정보 외 2종 | 지도 페이지 핀 + AI 도구 `search_jeju_places` |
| 올레길 코스 정보 | 올레길 위치 정보 (26개 코스: 번호·이름·시점·종점·km·소요시간·휠체어 여부) | 여행 정보 > 올레길 (`scripts/bake-olle.mjs`로 `public/data/olle.json`에 합침) |
| 한라산 둘레길 | 한라산 둘레길 코스별 정보 | 여행 정보 탭 + `get_hallasan_trails` |
| 버스 도착·위치·정류소 | 국토교통부 TAGO (제주 도시코드 39) | 여행 정보 > 대중교통 + `get_bus_arrivals` |
| 공항 운항 스케줄 | 한국공항공사 국내선 운항 스케줄 | 여행 정보 > 공항 + `get_flight_schedule` |
| 숙박 | 관광 숙박업 정보 | 여행 정보 > 숙박(지도·전화·홈페이지) + `search_lodging` |
| 선박 | 제주 여객선 운항 정보 | 여행 정보 > 선박(항구 지도) + `get_ferry_schedule` |
| 렌터카·쏘카존 | 렌터카 업체 / 쏘카존 위치 | 여행 정보 > 렌터카 + `search_jeju_places` |

`/api/photos?debug=1`로 사진 API 원본 응답(필드명·촬영월 형식)을, `/api/hub?kind=…&debug=1`로 허브 원본 응답을 확인할 수 있습니다.
> `server/photos.js`, `server/related.js`의 일부 파라미터·필드명은 활용가이드로 실제 호출해 확인이 필요합니다. (/status에서 실패하면 해당 파일 상단 주석 참고)

### 그 밖의 외부 데이터 (키 불필요)
| 용도 | 출처 |
|---|---|
| 한라산 둘레길·올레길 경로선 | OpenStreetMap(Overpass)에서 받아 `public/data/*.json`에 구워 둠 (올레길은 경로선 9코스, 나머지는 시점·종점 점선). 두루누비 API에는 제주 코스가 없음 |
| 도로·도보 길찾기 | OSRM 공개 서버 (`src/lib/routing.js`, 브라우저에서 호출) |
| 촬영 위치 → 주소 | 카카오 지오코더 (`src/lib/kakaoGeo.js`) |
| 3D 지형 | 고도: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/), 위성사진: [Sentinel-2 cloudless 2020](https://s2maps.eu) © EOX IT Services GmbH — Contains modified Copernicus Sentinel data 2020, **CC BY-NC-SA 4.0 (비영리·출처 표기 필수)**. 타일을 못 받으면 단순화된 3D 섬(`JejuStylized.jsx`)으로 자동 대체 |
| 이미지 | `public/images/`의 사진은 Pixabay 무료 이미지(Pixabay 콘텐츠 라이선스)를 웹용으로 줄인 것 |

공공데이터가 비어 있거나 실패하면 `src/data/landmarks.js`의 제주 대표 명소(관광지 24곳·오름 9곳)를 지도에 대신 표시합니다.

## 카카오 로그인 · 링크 공유
- **공유**: 코스 공유 링크(`/share?d=…`)는 코스 정보가 주소에 들어 있어 서버 저장 없이 누구나 열 수 있습니다. 카카오톡 공유는 지도와 같은 JavaScript 키(`VITE_KAKAO_MAP_KEY`)를 쓰며, 카카오 앱의 **JavaScript SDK 도메인**에 사이트 주소가 등록돼 있어야 합니다. 키가 없으면 기기 공유창 → 링크 복사로 대체됩니다.
- **카카오 로그인** (Supabase Auth의 Kakao provider):
  1. 카카오 디벨로퍼스 → 제품 설정 → **카카오 로그인** ON, Redirect URI에 `https://<프로젝트>.supabase.co/auth/v1/callback` 등록
  2. 카카오 로그인 → 보안 → **Client Secret** 발급·활성화, 동의항목에서 닉네임 등 설정 (이메일은 비즈 앱이어야 받을 수 있음)
  3. Supabase → Authentication → Sign In / Providers → **Kakao** 활성화, 카카오 **REST API 키**(Client ID)와 Client Secret 입력
  4. Supabase → Authentication → URL Configuration의 Site URL / Redirect URLs에 배포 주소와 `http://localhost:5173` 추가

## 프로젝트 구조
```
api/        Vercel 서버 함수 (/api/파일이름, 11개) — 얇은 껍데기, server/ 함수를 호출
            album.js: 미니앨범 문구 + 사진 AI 편집(action:'edit')
server/     공공데이터 호출 함수 + tools.js (AI 에이전트 도구) — 화면·에이전트가 같은 함수를 공유
src/
  main.jsx, router.jsx   테마 + 메뉴·주소
  layouts/               공통 틀 (메뉴·푸터·알림)
  store/useAppStore.js   닉네임·알림·보관함·AI 대화
  api/client.js          화면 → /api 호출
  components/            PhotoCard, PhotoEditor, WeatherBadge, Jeju3D, KakaoMap ...
  pages/                 Home, Explore, PhotoDetail, PhotoSpots, SpotUpload, Near, Album(사진 편집), Map3D, Info, Agent, My, StatusPage
  lib/                   photoEdit(보정 엔진), albumRender·albumTools·albumVideo(앨범·PPT·영상), kakaoGeo, routing, userSpots ...
public/data/             둘레길·올레길·숙박 JSON
scripts/                 bake-olle.mjs (허브 올레길 정보를 olle.json에 합치기)
supabase/                schema.sql, user_spots.sql, ai_usage.sql, migrate_auth.sql
docs/                    발표 자료 (제주픽-발표.pptx)
```

## 알려진 한계
- AI 기능(에이전트·사진 편집·미니앨범 문구)은 `ANTHROPIC_API_KEY`가 있는 운영 서버에서만 확인됩니다.
- 올레길 전체 GPX는 공식 데이터를 구할 수 없어 일부 코스만 경로선으로, 나머지는 시점·종점만 점선으로 표시합니다. 거리·소요 시간은 제주데이터허브 값입니다.
- 사진 편집 AI는 전체 보정(밝기·색감·자르기 등)만 하며, 배경 바꾸기·물체 지우기는 할 수 없습니다.
- 미니앨범 PPT의 자동 넘김은 PowerPoint 슬라이드쇼에서 동작합니다(뷰어에 따라 다를 수 있음). MP4 영상은 H.264를 지원하는 최신 브라우저에서만 만들 수 있습니다.
- 서버 함수는 Vercel Hobby 제한(12개)에 맞춰 11개로 유지합니다. 새 기능은 기존 함수에 합쳐 주세요.
- Supabase 무료 프로젝트는 일정 기간 접속이 없으면 일시 중지됩니다. 발표 전에 한 번 접속해 두세요.
