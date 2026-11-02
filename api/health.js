import { route } from '../server/http.js'
import { searchPhotos } from '../server/photos.js'
import { listSpots, findNearby } from '../server/tour.js'
import { getWeather } from '../server/weather.js'
import { checkAccessibility } from '../server/access.js'
import { getRelated } from '../server/related.js'
import { searchAwardPhotos } from '../server/photos.js'
import { getCrowd } from '../server/crowd.js'
import { getSunTimes } from '../server/sun.js'
import { listHubPlaces, getTrails } from '../server/hub.js'
import { searchStops, searchRoutes, getFlights } from '../server/transit.js'

// 각 공공데이터 API 를 1건씩 불러 보고 성공/실패를 알려 준다 (활용신청 승인 여부 확인용)
const time = async (name, fn) => {
  const t = Date.now()
  try { const r = await fn(); return { name, ok: true, ms: Date.now() - t, sample: Array.isArray(r) ? r.length : 1 } }
  catch (e) { return { name, ok: false, ms: Date.now() - t, error: e.message } }
}

export default route(async () => {
  const checks = await Promise.all([
    time('관광사진 정보', async () => {
      const r = await searchPhotos({ keyword: '성산', rows: 1 })
      if (!r.length) throw new Error('결과가 0건이에요 — 인증키(Decoding)와 관광사진 API 활용신청 승인 여부를 확인하세요')
      return r
    }),
    time('국문 관광정보 (장소 목록)', () => listSpots({ rows: 1 })),
    time('국문 관광정보 (주변 검색)', () => findNearby({ lat: 33.4584, lng: 126.9425, rows: 1 })),
    time('기상청 단기예보', () => getWeather({ place: '제주시' })),
    time('무장애 여행 정보', () => checkAccessibility({ place_name: '성산일출봉' })),
    time('연관 관광지 정보', () => getRelated({ place_name: '성산일출봉' })),
    time('관광공모전(사진) 수상작', () => searchAwardPhotos({ rows: 1 })),
    time('관광지 집중률 예측', () => getCrowd({ place_name: '성산일출봉', addr: '제주특별자치도 서귀포시' })),
    time('출몰시각 정보', () => getSunTimes({ lat: 33.4584, lng: 126.9425 })),
    time('TAGO 버스 정류소·노선', async () => {
      const [s, r] = await Promise.all([searchStops({ name: '제주국제공항', limit: 3 }), searchRoutes({ routeNo: '600', limit: 3 })])
      if (!s.length || !r.length) throw new Error('결과가 0건이에요 — TAGO 정류소정보·노선정보 활용신청 승인을 확인하세요')
      return s
    }),
    time('공항 운항 스케줄(국내선)', async () => {
      const f = await getFlights({ direction: 'arr' })
      if (!f.count) throw new Error('오늘 운항 편이 0건이에요 — 인증키·활용신청 승인을 확인하세요')
      return f.flights
    }),
    time('제주데이터허브 (오름)', () => listHubPlaces({ kind: 'oreum', name: '돌오름' })),
    time('제주데이터허브 (한라산 둘레길)', () => getTrails({})),
  ])
  return { checks, keys: { dataGoKr: Boolean(process.env.DATA_GO_KR_KEY), jejuHub: Boolean(process.env.JEJU_DATAHUB_KEY), anthropic: Boolean(process.env.ANTHROPIC_API_KEY) } }
})
