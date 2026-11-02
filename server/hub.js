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
  trail: '888tDaaDaat91181b7Db79811181tDaa',       // 한라산 둘레길 코스별 정보 (courseName, startPoint, endPoint)
}

export function hubKey() {
  const k = process.env.JEJU_DATAHUB_KEY
  if (!k) throw new Error('JEJU_DATAHUB_KEY 가 없어요. 제주데이터허브 프로젝트 키를 .env.local (배포는 Vercel 환경변수)에 넣고 다시 실행·배포해 주세요')
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

// 응답 항목 이름 비교용: 공백·밑줄·하이픈 제거 + 소문자 (예: ' courseName', 'course_name' → 'coursename')
const nk = (k) => String(k).replace(/[\s_-]/g, '').toLowerCase()
const loose = (row) => (row && typeof row === 'object' && !Array.isArray(row)
  ? new Proxy(row, { get: (o, p) => (typeof p === 'string' && !(p in o) ? o[Object.keys(o).find((k) => nk(k) === nk(p))] : o[p]) })
  : row)

async function request(name, params = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && String(v).trim() !== '') qs.set(k, String(v).trim())
  const r = await fetch(`${BASE}/${API[name]}/${hubKey()}?${qs}`, { signal: AbortSignal.timeout(12000) })
  const text = await r.text()
  let j
  try { j = JSON.parse(text) } catch { throw new Error(`제주데이터허브 응답이 JSON이 아님 (${r.status}): ${text.slice(0, 120)}`) }
  if (!r.ok) throw new Error(`제주데이터허브 오류 (${r.status}): ${j?.message || j?.error || text.slice(0, 100)}`)
  return { status: r.status, json: j }
}

// 제주데이터허브는 기본 10건씩만 돌려준다 → number(페이지 번호)·limit(한 번에 개수, 최대 100)로 전부 모은다
// 응답: { totCnt: 전체 건수, hasMore, data: [...] }
const PAGE = 100
export async function callHub(name, params = {}, maxRows = 500) {
  let first
  try { first = await request(name, { ...params, number: 1, limit: PAGE }) }
  catch (e) {
    if (/키가 없어요/.test(e.message)) throw e
    first = await request(name, params) // 이 API 가 number/limit 를 받지 않으면 한 번만 조회
    return unwrap(first.json).map(loose)
  }
  const rows = unwrap(first.json)
  const total = Math.min(Number(first.json?.totCnt) || rows.length, maxRows)
  const pages = Math.min(Math.ceil(total / PAGE), 10)
  if (pages > 1) {
    const rest = await Promise.all(Array.from({ length: pages - 1 }, (_, i) => request(name, { ...params, number: i + 2, limit: PAGE }).then((r) => unwrap(r.json))))
    rows.push(...rest.flat())
  }
  return rows.slice(0, maxRows).map(loose)
}

// 원본 응답 점검용 (/api/hub?kind=…&debug=1): 최상위 키, 전체 건수, 앞 2행
export async function debugHub(name, params = {}) {
  const { status, json } = await request(name, { ...params, number: 1, limit: 2 })
  const rows = unwrap(json)
  return {
    status, topKeys: Array.isArray(json) ? ['(배열)'] : Object.keys(json ?? {}),
    totCnt: json?.totCnt, hasMore: json?.hasMore, rowCount: rows.length, sample: rows.slice(0, 2),
  }
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

export async function listHubPlaces({ kind, name = '', limit = 1000 }) {
  if (!PLACE_KINDS[kind]) throw new Error(`알 수 없는 종류: ${kind}`)
  const rows = await callHub(kind, { placeName: name }, 1000)
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
    name: l.companyName, type: l.bizSmallType || l.bizLargeType || '', rooms: num(l.roomCount) || undefined,
    status: l.openStatus, addr: l.addressDoro || l.addressJibun,
  }))
}

export async function getTrails({ course = '', limit = 30 } = {}) {
  const rows = await callHub('trail', { courseName: course })
  return clip(rows, limit).map((t) => ({
    course: String(t.courseName ?? '').trim(), km: num(String(t.distance ?? '').replace(/[^\d.]/g, '')) || undefined,
    start: String(t.startPoint ?? '').trim(), end: String(t.endPoint ?? '').trim(),
  }))
}
