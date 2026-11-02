import { route } from '../server/http.js'
import { searchLodging, getBeachQuality, getTrails, getAccidentSpots, searchBusStops, getBusRoutes } from '../server/hub.js'

// /api/hub?kind=beach|trail|accident|busstop|busroute|lodging&...
const KINDS = {
  beach: (q) => getBeachQuality({ beach: q.beach, year: q.year, item: q.item }),
  trail: (q) => getTrails({ course: q.course }),
  accident: (q) => getAccidentSpots({ sigungu: q.sigungu }),
  busstop: (q) => searchBusStops({ name: q.name }),
  busroute: (q) => getBusRoutes({ startStationId: q.startStationId }),
  lodging: (q) => searchLodging({ name: q.name, type: q.type, status: q.status || '영업/정상' }),
}

export default route((q) => {
  const fn = KINDS[q.kind]
  if (!fn) throw new Error(`kind 는 ${Object.keys(KINDS).join(' | ')} 중 하나`)
  return fn(q)
}, { ttl: 3600 })
