// 제주데이터허브 (jejudatahub.net) 오픈 API
// 호출 형식: GET https://open.jejudatahub.net/api/proxy/{API 고유 ID}/{프로젝트 키}?변수=값
//  · 프로젝트 키 = 제주데이터허브 마이페이지에서 만든 "프로젝트"에 API 를 담으면 발급되는 키 (JEJU_DATAHUB_KEY)
//  · API 고유 ID 는 각 데이터 상세 페이지의 요청 URL 에 있는 값
// 주의: 응답 래핑 구조는 호출해 보고 확인 필요 → unwrap() 이 흔한 형태를 모두 처리하고, /status 에서 점검

const BASE = 'https://open.jejudatahub.net/api/proxy'

const API = {
  oreum: '1Dttb1tab8tD88Dtat11111at1t1atD8',       // 오름 위치 정보           (placeName)
  museum: 'at2ta1D1aaa811bata88Dt1D22b1t1bt',      // 박물관 및 미술관 위치 정보 (placeName)
  souvenir: '11D8at1abba0ttaDa8t8atta01188t81',    // 기념품 가게 위치 정보     (placeName)
  lodging: 'ttbttaD3aaa3ta8bbtDtaDD18t37aD17',     // 관광 숙박업 정보         (companyName, bizSmallType, openStatus)
  busStop: 'DD11ab6a6t11D16baaa1a2tD26ata161',     // 버스 정류소 기본 정보     (stationName)
  busRoute: 'aaatD6D1atta1611at1t6a1b6at1b11a',    // 버스 노선 기본 정보       (startStationId)
  trail: '888tDaaDaat91181b7Db79811181tDaa',       // 한라산 둘레길 코스별 정보 (courseName, startPoint, endPoint)
  beach: 'aa7t3a3tabDtbD38a87ta8ttttt388ab',       // 제주 해수욕장 수질 조사   (baseYear, beachName, measureItem)
  accident: '36333aD6tba8aa1D6D1aaab8D1aa6ba8',    // 교통사고 다발지역 정보    (sidoSigungu)
}

export function hubKey() {
  const k = process.env.JEJU_DATAHUB_KEY
  if (!k) throw new Error('JEJU_DATAHUB_KEY 가 없어요. 제주데이터허브 프로젝트 키를 .env.local 에 넣어 주세요')
  return k.trim()
}

// 응답에서 목록 배열을 꺼낸다 (data / items / result / list 등 어떤 래핑이든)
function unwrap(j) {
  if (Array.isArray(j)) return j
  for (const k of ['data', 'items', 'item', 'result', 'results', 'list', 'content', 'body']) {
    const v = j?.[k]
    if (Array.isArray(v)) return v
    if (v && typeof v === 'object') { const inner = unwrap(v); if (inner.length) return inner }
  }
  return []
}

export async function callHub(name, params = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && String(v).trim() !== '') qs.set(k, String(v).trim())
  const r = await fetch(`${BASE}/${API[name]}/${hubKey()}?${qs}`, { signal: AbortSignal.timeout(12000) })
  const text = await r.text()
  let j
  try { j = JSON.parse(text) } catch { throw new Error(`제주데이터허브 응답이 JSON이 아님 (${r.status}): ${text.slice(0, 120)}`) }
  if (!r.ok) throw new Error(`제주데이터허브 오류 (${r.status}): ${j?.message || j?.error || text.slice(0, 100)}`)
  return unwrap(j)
}

const num = (v) => Number(v)
const clip = (list, n) => list.slice(0, n)

// ── 좌표가 있는 장소 3종: 오름 · 박물관/미술관 · 기념품 가게 ──────────
const PLACE_KINDS = {
  oreum: { label: '오름' },
  museum: { label: '박물관·미술관' },
  souvenir: { label: '기념품 가게' },
}
export const PLACE_KIND_NAMES = Object.fromEntries(Object.entries(PLACE_KINDS).map(([k, v]) => [v.label, k]))

export async function listHubPlaces({ kind, name = '', limit = 400 }) {
  if (!PLACE_KINDS[kind]) throw new Error(`알 수 없는 종류: ${kind}`)
  const rows = await callHub(kind, { placeName: name })
  return clip(rows, limit)
    .map((p) => ({
      id: `hub-${kind}-${String(p.placeUrl ?? p.placeName).split('/').pop()}`,
      title: p.placeName,
      addr: p.addressDoro || p.addressJibun || '',
      lat: num(p.latitude), lng: num(p.longitude),
      type: kind, hub: true,
      category: p.category, url: p.placeUrl, tel: p.phone || undefined,
    }))
    .filter((p) => p.title && p.lat > 33 && p.lng > 126)
}

// ── 이동·숙박·자연 정보 ────────────────────────────────────────────
export async function searchLodging({ name = '', type = '', status = '영업/정상', limit = 30 } = {}) {
  const rows = await callHub('lodging', { companyName: name, bizSmallType: type, openStatus: status })
  return clip(rows, limit).map((l) => ({
    name: l.companyName, type: l.bizSmallType, rooms: num(l.roomCount) || undefined,
    status: l.openStatus, addr: l.addressDoro || l.addressJibun,
  }))
}

export async function getBeachQuality({ beach = '', year = '', item = '', limit = 60 } = {}) {
  const rows = await callHub('beach', { beachName: beach, baseYear: year, measureItem: item })
  return clip(rows, limit).map((b) => ({
    year: b.baseYear, beach: b.beachName, kind: b.beachType, phase: b.measureType,
    item: b.measureItem, point: b.measurePoint, value: b.measureValue, suitable: b.suitabilityFlag,
  }))
}

export async function getTrails({ course = '', limit = 30 } = {}) {
  const rows = await callHub('trail', { courseName: course })
  return clip(rows, limit).map((t) => ({
    course: String(t.courseName ?? '').trim(), km: num(String(t.distance ?? '').replace(/[^\d.]/g, '')) || undefined,
    start: String(t.startPoint ?? '').trim(), end: String(t.endPoint ?? '').trim(),
  }))
}

export async function getAccidentSpots({ sigungu = '', limit = 20 } = {}) {
  const rows = await callHub('accident', { sidoSigungu: sigungu })
  return rows
    .map((a) => ({
      area: a.sidoSigungu, place: a.occurrencePlace, count: num(a.occurrenceCount) || 0,
      casualties: num(a.deathInjuryCount) || 0, deaths: num(a.deathCount) || 0,
      lat: num(a.latitude), lng: num(a.longitude),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export async function searchBusStops({ name = '', limit = 30 } = {}) {
  const rows = await callHub('busStop', { stationName: name })
  return clip(rows, limit).map((s) => ({
    id: s.stationId, name: s.stationName, addr: s.stationAddress, direction: s.direction,
    lat: num(s.latitude), lng: num(s.longitude),
  }))
}

export async function getBusRoutes({ startStationId = '', limit = 30 } = {}) {
  const rows = await callHub('busRoute', { startStationId })
  return clip(rows, limit).map((r) => ({
    id: r.routeId, name: r.routeName, number: r.routeNumber, from: r.startStationName, to: r.endStationName,
    stops: num(r.stationCount) || undefined, km: num(r.routeLength) || undefined,
  }))
}
