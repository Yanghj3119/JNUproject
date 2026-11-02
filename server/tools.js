// AI 에이전트 도구 모음 — 화면용 /api 와 같은 함수를 재사용
import { searchPhotos, getPhotoInfo } from './photos.js'
import { findNearby, resolvePlace, listSpots, CATEGORY } from './tour.js'
import { PHOTO_THEMES, themesOf } from '../src/data/photoThemes.js'
import { searchStops, getArrivals, getFlights, getFerries } from './transit.js'
import { getWeather } from './weather.js'
import { checkAccessibility } from './access.js'
import { getRelated } from './related.js'
import { getCrowd } from './crowd.js'
import { listHubPlaces, PLACE_KIND_NAMES, searchLodging, getTrails } from './hub.js'

// ① 도구 설명서: Claude 는 이 설명만 보고 "어떤 도구를 언제 쓸지" 결정한다
export const tools = [
  {
    name: 'search_photos',
    description: '키워드로 제주 관광 사진을 검색한다. 사진 제목·촬영지·사진 URL을 돌려준다. 어떤 곳이 있는지 둘러볼 때 먼저 쓴다.',
    input_schema: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '검색어 (예: 오름, 바다, 폭포, 유채꽃, 일출)' },
        limit: { type: 'integer', description: '결과 개수 (기본 6, 최대 12)' },
      },
    },
  },
  {
    name: 'get_photo_info',
    description: '사진 제목이나 촬영지로 촬영지·촬영시기와, 그곳의 실제 관광지 정보(주소·좌표·소개)를 조회한다.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '사진 제목' },
        location: { type: 'string', description: '촬영지' },
      },
    },
  },
  {
    name: 'find_nearby',
    description: '장소 이름(또는 좌표) 주변의 관광지·음식점·문화시설 등을 가까운 순으로 찾는다.',
    input_schema: {
      type: 'object',
      properties: {
        place_name: { type: 'string', description: '기준 장소 이름 (예: 성산일출봉)' },
        lat: { type: 'number' }, lng: { type: 'number' },
        radius_m: { type: 'integer', description: '반경(미터), 기본 3000' },
        category: { type: 'string', enum: Object.keys(CATEGORY), description: '분류 (생략하면 전체)' },
      },
    },
  },
  {
    name: 'get_weather',
    description: '기상청 단기예보로 지역의 앞으로 몇 시간 기온·하늘·강수확률을 조회한다. 지역명 또는 좌표를 받는다.',
    input_schema: {
      type: 'object',
      properties: {
        place_name: { type: 'string', description: '제주시, 서귀포시, 성산, 애월, 한림, 표선, 중문 중 하나 또는 관광지 이름' },
        lat: { type: 'number' }, lng: { type: 'number' },
      },
    },
  },
  {
    name: 'check_accessibility',
    description: '장소의 무장애(휠체어·유모차·엘리베이터·장애인 화장실 등) 정보를 조회한다. 어르신·아이·장애인 동반 여행 질문에 쓴다.',
    input_schema: {
      type: 'object',
      properties: { place_name: { type: 'string', description: '관광지 이름' } },
      required: ['place_name'],
    },
  },
  {
    name: 'get_related_places',
    description: '관광지와 함께 많이 방문하는 연관 관광지(여행 동선 추천)를 조회한다.',
    input_schema: {
      type: 'object',
      properties: { place_name: { type: 'string', description: '관광지 이름' } },
      required: ['place_name'],
    },
  },
  {
    name: 'get_crowd_forecast',
    description: '관광지의 향후 30일 방문객 집중률(혼잡도) 예측을 조회한다. 한적한 날짜를 추천할 때 쓴다. 값이 높을수록 붐빈다.',
    input_schema: {
      type: 'object',
      properties: { place_name: { type: 'string', description: '관광지 이름' } },
      required: ['place_name'],
    },
  },
  {
    name: 'search_jeju_places',
    description: '제주데이터허브 데이터로 오름·박물관/미술관·기념품 가게를 찾는다. name 으로 이름 검색하거나, near 에 기준 장소를 주면 가까운 순으로 돌려준다. 비 오는 날 실내 대안(박물관·미술관)이나 오름 추천에 쓴다.',
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: Object.keys(PLACE_KIND_NAMES), description: '종류' },
        name: { type: 'string', description: '장소 이름 일부 (선택)' },
        near: { type: 'string', description: '기준 장소 이름 (예: 성산일출봉). 주면 가까운 순' },
      },
      required: ['kind'],
    },
  },
  {
    name: 'search_lodging',
    description: '제주 관광 숙박업(관광호텔·가족호텔·호스텔·휴양콘도 등) 정보를 이름·업종으로 조회한다. 객실 수와 주소를 돌려준다.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '사업장명 일부 (선택)' },
        type: { type: 'string', enum: ['가족호텔업', '관광호텔업', '소형호텔업', '의료관광호텔업', '호스텔업', '휴양콘도미니엄업'], description: '업종 (선택)' },
      },
    },
  },
  {
    name: 'get_hallasan_trails',
    description: '한라산 둘레길 코스(코스명·거리 km·시점·종점)를 조회한다. 걷기·트레킹 여행 질문에 쓴다.',
    input_schema: { type: 'object', properties: { course: { type: 'string', description: '코스명 (선택)' } } },
  },
  {
    name: 'get_bus_arrivals',
    description: '제주 버스 정류소의 실시간 도착 정보를 조회한다 (노선 번호, 몇 분 뒤 도착, 몇 정거장 전, 저상버스 여부). 정류소 이름 일부로 찾는다. 대중교통으로 이동하는 방법을 물을 때 쓴다.',
    input_schema: {
      type: 'object',
      properties: { stop_name: { type: 'string', description: '정류소 이름 일부 (예: 제주국제공항, 성산, 동문시장)' } },
      required: ['stop_name'],
    },
  },
  {
    name: 'get_ferry_schedule',
    description: '제주 여객선의 오늘 운항 시간표(출발·도착 예정 시각, 선박, 요금)를 항구별로 조회한다. 제주항(추자도·완도·진도·목포행), 운진항(가파도·마라도행), 송악산(마라도행), 추자도, 가파도, 마라도, 제주국제 항을 지원한다. 목록에 없는 항로는 모른다고 말한다. 기상에 따라 결항될 수 있다.',
    input_schema: {
      type: 'object',
      properties: { port: { type: 'string', enum: ['제주항', '제주국제', '운진항', '송악산', '추자도', '가파도', '마라도'], description: '출발 항구' } },
      required: ['port'],
    },
  },
  {
    name: 'get_flight_schedule',
    description: '제주공항의 오늘 국내선 운항 스케줄(예정 시각)을 조회한다. 도착(arr) 또는 출발(dep)과 상대 공항 코드(GMP 김포, PUS 김해, ICN 인천 등)를 줄 수 있다. 지연·결항은 반영되지 않는다.',
    input_schema: {
      type: 'object',
      properties: {
        direction: { type: 'string', enum: ['arr', 'dep'], description: 'arr=제주 도착, dep=제주 출발' },
        city_code: { type: 'string', description: '상대 공항 코드 (선택)' },
      },
    },
  },
  {
    name: 'find_photo_spots',
    description: `사진이 잘 나오는 제주 포토 스팟(사진이 등록된 관광지)을 테마별로 찾는다. 테마: ${PHOTO_THEMES.map((t) => `${t.id}=${t.label}`).join(', ')}. near 에 기준 장소를 주면 가까운 순으로 돌려준다. 일출·일몰·꽃·바다 사진 명소를 물을 때 쓴다.`,
    input_schema: {
      type: 'object',
      properties: {
        theme: { type: 'string', enum: PHOTO_THEMES.map((t) => t.id), description: '테마 (생략하면 전체)' },
        near: { type: 'string', description: '기준 장소 이름 (예: 성산일출봉). 주면 가까운 순' },
      },
    },
  },
  {
    name: 'propose_route',
    description: '사용자에게 보여 줄 여행 코스(경로)를 만든다. 코스·일정·동선을 추천할 때, 다른 도구로 장소를 확인한 뒤 방문 순서대로 3~6곳을 넣어 마지막에 한 번 호출한다. 각 장소는 실제 관광지 이름이어야 한다. 박물관·미술관·오름·기념품 가게처럼 다른 도구 결과에 lat/lng 가 있으면 반드시 함께 넣는다.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '코스 제목 (예: 성산 일출 반나절 코스)' },
        stops: {
          type: 'array',
          description: '방문 순서대로의 장소',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: '관광지 이름' },
              note: { type: 'string', description: '이 장소에서 할 일·팁 (한 문장)' },
              lat: { type: 'number', description: '다른 도구 결과에 이 장소의 위도가 있으면 그대로 넣는다 (가장 정확함)' },
              lng: { type: 'number', description: '다른 도구 결과에 이 장소의 경도가 있으면 그대로 넣는다' },
            },
            required: ['name'],
          },
        },
      },
      required: ['title', 'stops'],
    },
  },
]

// 좌표가 없으면 장소명으로 찾아서 채워 준다
async function withCoords({ place_name, lat, lng }) {
  if (Number(lat) && Number(lng)) return { lat: Number(lat), lng: Number(lng), name: place_name }
  const p = place_name && (await resolvePlace(place_name))
  if (!p) throw new Error(`"${place_name}" 위치를 찾지 못했어요`)
  return { lat: p.lat, lng: p.lng, name: p.title, id: p.id }
}

// ② 도구 이름 → 실제 실행할 함수 (토큰 절약을 위해 결과를 줄여서 반환)
export const runTool = {
  search_photos: async ({ keyword = '', limit = 6 }) =>
    (await searchPhotos({ keyword, rows: Math.min(Number(limit) || 6, 12) }))
      .map(({ title, location, photographer, image }) => ({ title, location, photographer, image })),

  get_photo_info: async ({ title = '', location = '' }) => {
    const { photo, place } = await getPhotoInfo({ title, location })
    return {
      photo: { title: photo.title, location: photo.location, photographer: photo.photographer },
      place: place && { name: place.title, addr: place.addr, lat: place.lat, lng: place.lng, overview: place.overview?.slice(0, 300) },
    }
  },

  find_nearby: async ({ category, radius_m, ...rest }) => {
    const c = await withCoords(rest)
    return (await findNearby({ lat: c.lat, lng: c.lng, radius: radius_m, contentTypeId: CATEGORY[category] ?? '', exclude: c.id, rows: 8 }))
      .map(({ title, addr, dist, type }) => ({ title, addr, dist_m: dist, type }))
  },

  get_weather: async ({ place_name, lat, lng }) => {
    const known = ['제주시', '서귀포시', '성산', '애월', '한림', '표선', '중문'].includes(place_name)
    const c = known ? {} : await withCoords({ place_name, lat, lng })
    const w = await getWeather({ place: known ? place_name : '', lat: c.lat, lng: c.lng })
    return { place: w.place, advice: w.advice, sun: w.sun, forecast: w.forecast.slice(0, 6) }
  },

  search_jeju_places: async ({ kind, name = '', near = '' }) => {
    let list = await listHubPlaces({ kind: PLACE_KIND_NAMES[kind], name })
    if (near) {
      const c = await withCoords({ place_name: near })
      const d = Math.PI / 180
      const km = (p) => Math.hypot((p.lng - c.lng) * d * Math.cos(c.lat * d), (p.lat - c.lat) * d) * 6371
      list = list.map((p) => ({ ...p, km: Math.round(km(p) * 10) / 10 })).sort((a, b) => a.km - b.km)
    }
    return list.slice(0, 8).map(({ title, addr, lat, lng, km }) => ({ title, addr, lat, lng, km_from_base: km }))
  },
  search_lodging: async ({ name, type }) => (await searchLodging({ name, type, limit: 10 })),
  get_hallasan_trails: async ({ course }) => getTrails({ course, limit: 12 }),
  get_bus_arrivals: async ({ stop_name }) => {
    const stops = (await searchStops({ name: stop_name, limit: 6 })).slice(0, 4)
    if (!stops.length) return { note: `"${stop_name}" 정류소를 찾지 못했어요` }
    return Promise.all(stops.map(async (s) => ({
      stop: s.name,
      arrivals: (await getArrivals({ nodeId: s.id }).catch(() => [])).slice(0, 5)
        .map((a) => ({ route: a.route, minutes: a.minutes, stops_away: a.stopsAway, low_floor: a.lowFloor })),
    })))
  },

  get_flight_schedule: async ({ direction = 'arr', city_code = '' }) => {
    const f = await getFlights({ direction, city: city_code })
    const now = new Date(Date.now() + 9 * 3600e3).toISOString().slice(11, 16) // 한국시간 HH:MM
    return {
      date: f.date, note: '예정 시각 기준이며 지연·결항은 반영되지 않아요', now_kst: now, total_today: f.count,
      next: f.flights.filter((x) => x.time >= now).slice(0, 8).map((x) => ({ flight: x.flight, airline: x.airline, from: x.from, to: x.to, dep: x.dep, arr: x.arr })),
    }
  },

  get_ferry_schedule: async ({ port = '제주항' }) => {
    const f = await getFerries({ port })
    const now = new Date(Date.now() + 9 * 3600e3).toISOString().slice(11, 16)
    return {
      date: f.date, port: f.port, note: '예정 시각 기준이며 기상에 따라 결항될 수 있어요', now_kst: now, total_today: f.count,
      next: f.sailings.filter((x) => x.dep >= now).slice(0, 10).map((x) => ({ ship: x.ship, from: x.from, to: x.to, dep: x.dep, arr: x.arr, fare_won: x.fare })),
    }
  },

  find_photo_spots: async ({ theme = '', near = '' }) => {
    // 관광지 최대 300곳 중 사진이 있는 곳을 테마(이름 키워드)로 거른다
    const pages = await Promise.all([1, 2, 3].map((page) => listSpots({ type: '12', rows: 100, page }).catch(() => [])))
    const seen = new Set()
    let list = pages.flat().filter((s) => s.image && !seen.has(s.id) && seen.add(s.id))
    if (theme) list = list.filter((s) => themesOf(s).includes(theme))
    if (near) {
      const c = await withCoords({ place_name: near })
      const d = Math.PI / 180
      const km = (p) => Math.hypot((p.lng - c.lng) * d * Math.cos(c.lat * d), (p.lat - c.lat) * d) * 6371
      list = list.map((p) => ({ ...p, km: Math.round(km(p) * 10) / 10 })).sort((a, b) => a.km - b.km)
    }
    return list.slice(0, 8).map(({ title, addr, lat, lng, km }) => ({ title, addr, lat, lng, km_from_base: km, themes: themesOf({ title }) }))
  },

  // 장소 이름들을 실제 좌표로 확인하고, 구간 거리(km)를 계산해 코스로 묶는다
  propose_route: async ({ title = '제주 코스', stops = [] }) => {
    // 다른 도구에서 받은 좌표가 함께 오면(제주 안이면) 그대로 쓰고, 아니면 이름으로 찾는다
    const known = (s) => Number(s.lat) > 33 && Number(s.lat) < 34 && Number(s.lng) > 126 && Number(s.lng) < 127.1
    const resolved = await Promise.all(stops.slice(0, 8).map(async (s) => ({
      s,
      p: known(s)
        ? { title: s.name, id: `pt-${s.name}`, addr: s.addr ?? '', lat: Number(s.lat), lng: Number(s.lng) }
        : await resolvePlace(s.name).catch(() => null),
    })))
    const found = resolved.filter((r) => r.p).map(({ s, p }) => ({
      name: p.title, note: s.note ?? '', id: p.id, addr: p.addr, lat: p.lat, lng: p.lng, image: p.image,
    }))
    const km = (a, b) => {
      const d = Math.PI / 180
      return Math.hypot((b.lng - a.lng) * d * Math.cos(((a.lat + b.lat) / 2) * d), (b.lat - a.lat) * d) * 6371
    }
    let total = 0
    found.forEach((f, i) => { f.leg_km = i ? Math.round(km(found[i - 1], f) * 10) / 10 : 0; total += f.leg_km })
    return { title, stops: found, not_found: resolved.filter((r) => !r.p).map((r) => r.s.name), total_km: Math.round(total * 10) / 10 }
  },

  get_crowd_forecast: async ({ place_name }) => {
    const c = await getCrowd({ place_name })
    return { name: c.name, quietest: c.quietest, days: c.days.slice(0, 14) }
  },

  check_accessibility: async ({ place_name }) => checkAccessibility({ place_name }),

  get_related_places: async ({ place_name }) => getRelated({ place_name }),
}
