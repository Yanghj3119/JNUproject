// AI 에이전트 도구 모음 — 화면용 /api 와 같은 함수를 재사용
import { searchPhotos, getPhotoInfo } from './photos.js'
import { findNearby, resolvePlace, CATEGORY } from './tour.js'
import { getWeather } from './weather.js'
import { checkAccessibility } from './access.js'
import { getRelated } from './related.js'

// ① 도구 설명서: Claude 는 이 설명만 보고 "어떤 도구를 언제 쓸지" 결정한다
export const tools = [
  {
    name: 'search_photos',
    description: '키워드로 제주 관광 사진을 검색한다. 사진 제목·촬영지·촬영월·사진 URL을 돌려준다. 어떤 곳이 있는지 둘러볼 때 먼저 쓴다.',
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
      .map(({ title, location, month, photographer, image }) => ({ title, location, month, photographer, image })),

  get_photo_info: async ({ title = '', location = '' }) => {
    const { photo, place } = await getPhotoInfo({ title, location })
    return {
      photo: { title: photo.title, location: photo.location, month: photo.month, photographer: photo.photographer },
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
    return { place: w.place, advice: w.advice, forecast: w.forecast.slice(0, 6) }
  },

  check_accessibility: async ({ place_name }) => checkAccessibility({ place_name }),

  get_related_places: async ({ place_name }) => getRelated({ place_name }),
}
