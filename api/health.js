import { route } from '../server/http.js'
import { searchPhotos } from '../server/photos.js'
import { listSpots, findNearby } from '../server/tour.js'
import { getWeather } from '../server/weather.js'
import { checkAccessibility } from '../server/access.js'
import { getRelated } from '../server/related.js'

// 각 공공데이터 API 를 1건씩 불러 보고 성공/실패를 알려 준다 (활용신청 승인 여부 확인용)
const time = async (name, fn) => {
  const t = Date.now()
  try { const r = await fn(); return { name, ok: true, ms: Date.now() - t, sample: Array.isArray(r) ? r.length : 1 } }
  catch (e) { return { name, ok: false, ms: Date.now() - t, error: e.message } }
}

export default route(async () => {
  const checks = await Promise.all([
    time('관광사진 정보', () => searchPhotos({ keyword: '성산', rows: 1 })),
    time('국문 관광정보 (장소 목록)', () => listSpots({ rows: 1 })),
    time('국문 관광정보 (주변 검색)', () => findNearby({ lat: 33.4584, lng: 126.9425, rows: 1 })),
    time('기상청 단기예보', () => getWeather({ place: '제주시' })),
    time('무장애 여행 정보', () => checkAccessibility({ place_name: '성산일출봉' })),
    time('연관 관광지 정보', () => getRelated({ place_name: '성산일출봉' })),
  ])
  return { checks, keys: { dataGoKr: Boolean(process.env.DATA_GO_KR_KEY), anthropic: Boolean(process.env.ANTHROPIC_API_KEY) } }
})
