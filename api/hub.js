import { route } from '../server/http.js'
import { searchLodging, getTrails, getAccidentSpots, searchBusStops, getBusRoutes, debugHub } from '../server/hub.js'

// /api/hub?kind=trail|accident|busstop|busroute|lodging&...   (&debug=1 → 제주데이터허브 원본 응답 점검)
const KINDS = {
  trail: (q) => getTrails({ course: q.course }),
  accident: (q) => getAccidentSpots({ sigungu: q.sigungu }),
  busstop: (q) => searchBusStops({ name: q.name }),
  busroute: (q) => getBusRoutes({ startStationId: q.startStationId }),
  lodging: (q) => searchLodging({ name: q.name, type: q.type, status: q.status || '영업/정상' }),
}

// debug 용: kind → hub.js 의 API 이름과 기본 요청 변수
const RAW = {
  trail: ['trail', () => ({})],
  accident: ['accident', (q) => ({ sidoSigungu: q.sigungu })],
  busstop: ['busStop', (q) => ({ stationName: q.name })],
  busroute: ['busRoute', (q) => ({ startStationId: q.startStationId })],
  lodging: ['lodging', (q) => ({ companyName: q.name, bizSmallType: q.type, openStatus: q.status || '영업/정상' })],
  oreum: ['oreum', (q) => ({ placeName: q.name })],
  museum: ['museum', (q) => ({ placeName: q.name })],
  souvenir: ['souvenir', (q) => ({ placeName: q.name })],
}

export default route((q) => {
  if (q.debug) {
    const raw = RAW[q.kind]
    if (!raw) throw new Error(`kind 는 ${Object.keys(RAW).join(' | ')} 중 하나`)
    return debugHub(raw[0], raw[1](q))
  }
  const fn = KINDS[q.kind]
  if (!fn) throw new Error(`kind 는 ${Object.keys(KINDS).join(' | ')} 중 하나`)
  return fn(q)
}, { ttl: 3600 })
