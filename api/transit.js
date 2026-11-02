import { route } from '../server/http.js'
import { searchStops, nearStops, getArrivals, searchRoutes, getBusPositions, getFlights, getFerries, getRouteStops } from '../server/transit.js'

// /api/transit?kind=stops|arrivals|routes|positions|flights
const KINDS = {
  stops: (q) => searchStops({ name: q.name }),
  near: (q) => nearStops({ lat: q.lat, lng: q.lng }),
  arrivals: (q) => getArrivals({ nodeId: q.nodeId }),
  routes: (q) => searchRoutes({ routeNo: q.routeNo }),
  positions: (q) => getBusPositions({ routeId: q.routeId }),
  routestops: (q) => getRouteStops({ routeId: q.routeId }),
  flights: (q) => getFlights({ direction: q.direction, city: q.city, date: q.date }),
  ferries: (q) => getFerries({ port: q.port, date: q.date }),
}

// 실시간 정보라 캐시를 짧게 (도착·위치 15초, 공항 스케줄 10분)
export default async function handler(req, res) {
  const fn = KINDS[req.query?.kind]
  if (!fn) return res.status(400).json({ error: `kind 는 ${Object.keys(KINDS).join(' | ')} 중 하나` })
  const ttl = req.query.kind === 'flights' || req.query.kind === 'ferries' ? 600 : req.query.kind === 'arrivals' || req.query.kind === 'positions' ? 15 : 3600
  return route(fn, { ttl })(req, res)
}
