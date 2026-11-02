// 대중교통·공항 — 공공데이터포털 키 하나로 사용
//  · 국토교통부 TAGO 버스 서비스 (제주 도시코드 = 39, 정류소 ID 는 'JEB…' 형식)
//    - 정류소정보 BusSttnInfoInqireService / 버스도착정보 ArvlInfoInqireService
//    - 버스노선정보 BusRouteInfoInqireService / 버스위치정보 BusLcInfoInqireService
//  · 한국공항공사 항공기 운항 스케줄 (국내선) — 예정 시각이며 지연·결항은 반영되지 않는다
import { callApi, toList } from './lib.js'
import { cached } from './cache.js'

const TAGO = 'https://apis.data.go.kr/1613000'
const CITY = 39 // 제주도
const FLIGHT = 'https://apis.data.go.kr/B551178/flight-schedule/dom'

// ── 버스 ────────────────────────────────────────────────────
async function loadStops({ name = '', limit = 20 } = {}) {
  const body = await callApi(`${TAGO}/BusSttnInfoInqireService/getSttnNoList`, { _type: 'json', cityCode: CITY, nodeNm: name, numOfRows: limit, pageNo: 1 })
  return toList(body).map((s) => ({ id: s.nodeid, name: s.nodenm, no: s.nodeno, lat: Number(s.gpslati), lng: Number(s.gpslong) }))
}

// 정류소에 곧 도착하는 버스 (몇 분 뒤 · 몇 정거장 전 · 저상버스 여부) — 가까운 순
export async function getArrivals({ nodeId } = {}) {
  if (!nodeId) throw new Error('nodeId 가 필요해요')
  const body = await callApi(`${TAGO}/ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList`, { _type: 'json', cityCode: CITY, nodeId, numOfRows: 40, pageNo: 1 })
  return toList(body)
    .map((a) => ({
      routeId: a.routeid, route: String(a.routeno), type: a.routetp, seconds: Number(a.arrtime) || 0,
      minutes: Math.max(0, Math.round((Number(a.arrtime) || 0) / 60)), stopsAway: Number(a.arrprevstationcnt) || 0,
      lowFloor: /저상/.test(a.vehicletp ?? ''),
    }))
    .sort((a, b) => a.seconds - b.seconds)
}

export async function searchRoutes({ routeNo = '', limit = 20 } = {}) {
  const body = await callApi(`${TAGO}/BusRouteInfoInqireService/getRouteNoList`, { _type: 'json', cityCode: CITY, routeNo, numOfRows: limit, pageNo: 1 })
  return toList(body).map((r) => ({ routeId: r.routeid, no: String(r.routeno), type: r.routetp, from: r.startnodenm, to: r.endnodenm }))
}

// 노선을 달리는 버스의 현재 위치 (가까운 정류장 기준으로 갱신됨)
export async function getBusPositions({ routeId } = {}) {
  if (!routeId) throw new Error('routeId 가 필요해요')
  const body = await callApi(`${TAGO}/BusLcInfoInqireService/getRouteAcctoBusLcList`, { _type: 'json', cityCode: CITY, routeId, numOfRows: 100, pageNo: 1 })
  return toList(body)
    .map((b) => ({ vehicle: b.vehicleno, lat: Number(b.gpslati), lng: Number(b.gpslong), stopName: b.nodenm, order: Number(b.nodeord) || 0, route: String(b.routenm), type: b.routetp }))
    .filter((b) => b.lat > 33 && b.lng > 126)
}

// ── 공항 (제주 CJU) ─────────────────────────────────────────
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const hhmm = (v) => (/^\d{4}$/.test(String(v ?? '')) ? `${String(v).slice(0, 2)}:${String(v).slice(2)}` : '')
const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replaceAll('-', '')

// direction: 'arr'(제주 도착) | 'dep'(제주 출발) / city: 상대 공항 코드(GMP·PUS 등, 선택) / date: YYYYMMDD(기본 오늘)
async function loadFlights({ direction = 'arr', city = '', date = '' } = {}) {
  const day = /^\d{8}$/.test(date) ? date : kstToday()
  const base = { type: 'json', schDate: day, numOfRows: 100 }
  const q = direction === 'dep'
    ? { ...base, schDeptCityCode: 'CJU', ...(city && { schArrvCityCode: city }) }
    : { ...base, schArrvCityCode: 'CJU', ...(city && { schDeptCityCode: city }) }

  const first = await callApi(FLIGHT, { ...q, pageNo: 1 })
  const total = Number(first.totalCount) || 0
  const rest = await Promise.all(Array.from({ length: Math.min(Math.ceil(total / 100) - 1, 4) }, (_, i) => callApi(FLIGHT, { ...q, pageNo: i + 2 }).then(toList)))
  const rows = [...toList(first), ...rest.flat()]

  // 오늘 운항하는 편만: 운항 기간 안 + 그 요일에 취항
  const dow = DAY[new Date(Date.UTC(+day.slice(0, 4), +day.slice(4, 6) - 1, +day.slice(6, 8))).getUTCDay()]
  const flights = rows
    .filter((f) => f[`domestic${dow}`] === 'Y' && String(f.domesticStdate).slice(0, 10).replaceAll('-', '') <= day && String(f.domesticEddate).slice(0, 10).replaceAll('-', '') >= day)
    .map((f) => ({
      flight: f.domesticNum, airline: f.airlineKorean, from: f.startcity, fromCode: f.startcityCode, to: f.arrivalcity, toCode: f.arrivalcityCode,
      dep: hhmm(f.domesticStartTime), arr: hhmm(f.domesticArrivalTime),
      time: hhmm(direction === 'dep' ? f.domesticStartTime : f.domesticArrivalTime),
    }))
    .filter((f) => f.time)
    .sort((a, b) => a.time.localeCompare(b.time))
  return { date: day, direction, count: flights.length, flights }
}

// 정류소 목록은 1시간, 공항 스케줄은 10분 캐시 (도착·위치는 실시간이라 캐시하지 않는다)
export const searchStops = (args = {}) => cached(`stops:${args.name ?? ''}:${args.limit ?? ''}`, 60 * 60e3, () => loadStops(args))
export const getFlights = (args = {}) => cached(`flights:${args.direction ?? ''}:${args.city ?? ''}:${args.date ?? ''}`, 10 * 60e3, () => loadFlights(args))
