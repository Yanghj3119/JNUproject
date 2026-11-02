import { route } from '../server/http.js'
import { searchStops, getArrivals, searchRoutes, getBusPositions, getFlights } from '../server/transit.js'

// /api/transit?kind=stops|arrivals|routes|positions|flights
const KINDS = {
  stops: (q) => searchStops({ name: q.name }),
  arrivals: (q) => getArrivals({ nodeId: q.nodeId }),
  routes: (q) => searchRoutes({ routeNo: q.routeNo }),
  positions: (q) => getBusPositions({ routeId: q.routeId }),
  flights: (q) => getFlights({ direction: q.direction, city: q.city, date: q.date }),
}

// 실시간 정보라 캐시를 짧게 (도착·위치 15초, 공항 스케줄 10분)
export default async function handler(req, res) {
  const fn = KINDS[req.query?.kind]
  if (!fn) return res.status(400).json({ error: `kind 는 ${Object.keys(KINDS).join(' | ')} 중 하나` })
  const ttl = req.query.kind === 'flights' ? 600 : req.query.kind === 'arrivals' || req.query.kind === 'positions' ? 15 : 3600
  return route(fn, { ttl })(req, res)
}
