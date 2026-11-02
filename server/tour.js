// 한국관광공사 국문 관광정보 서비스_GW (KorService2)
import { callApi, toList, tourParams, https, stripHtml, inJeju } from './lib.js'
import { cached } from './cache.js'
import { listHubPlaces } from './hub.js'
import { kakaoPlace } from './kakaoLocal.js'
import { FALLBACK_SPOTS } from '../src/data/landmarks.js'

const BASE = 'https://apis.data.go.kr/B551011/KorService2'

export const CATEGORY = { 관광지: '12', 문화시설: '14', 축제: '15', 레포츠: '28', 숙박: '32', 쇼핑: '38', 음식점: '39' }

const place = (p) => ({
  id: String(p.contentid),
  title: p.title,
  addr: p.addr1,
  image: https(p.firstimage),
  lng: Number(p.mapx),
  lat: Number(p.mapy),
  type: p.contenttypeid,
  dist: p.dist ? Math.round(Number(p.dist)) : undefined,
  tel: p.tel || undefined,
})

// 3D 지도용 — 제주 전체에서 이미지가 있는 대표 장소들
export function listSpots(args = {}) {
  const { type = '12', rows = 40, page = 1 } = args
  return cached(`spots:${type}:${rows}:${page}`, 30 * 60e3, () => loadSpots(args))
}

async function loadSpots({ type = '12', rows = 40, page = 1 } = {}) {
  const body = await callApi(`${BASE}/areaBasedList2`, tourParams({
    areaCode: 39, contentTypeId: type, numOfRows: Math.min(Number(rows) || 40, 100), pageNo: Math.max(Number(page) || 1, 1), arrange: 'Q',
  }))
  return toList(body).map(place).filter((p) => inJeju(p.lat, p.lng))
}

export async function searchPlaces({ keyword, contentTypeId = '', rows = 10 } = {}) {
  const body = await callApi(`${BASE}/searchKeyword2`, tourParams({
    keyword, areaCode: 39, contentTypeId, numOfRows: rows, pageNo: 1, arrange: 'O',
  }))
  return toList(body).map(place)
}

// ③ find_nearby — 좌표 주변 명소 (가까운 순)
export async function findNearby({ lat, lng, radius = 3000, contentTypeId = '', rows = 10, exclude = '' } = {}) {
  if (!(Number(lat) && Number(lng))) throw new Error('lat, lng 가 필요해요')
  const body = await callApi(`${BASE}/locationBasedList2`, tourParams({
    mapX: lng, mapY: lat, radius: Math.min(Number(radius) || 3000, 20000),
    contentTypeId, numOfRows: Number(rows) + 1, pageNo: 1, arrange: 'E',
  }))
  return toList(body).map(place).filter((p) => p.id !== String(exclude)).slice(0, rows)
}

export async function getPlaceDetail({ contentId }) {
  if (!/^\d+$/.test(String(contentId))) return null // 관광공사 장소만 상세 조회 가능
  const body = await callApi(`${BASE}/detailCommon2`, tourParams({ contentId }))
  const d = toList(body)[0]
  if (!d) return null
  return { overview: stripHtml(d.overview), homepage: stripHtml(d.homepage), tel: d.tel || undefined }
}

// "제주 성산일출봉" 같은 촬영지 문구 → 좌표가 있는 실제 관광지 1건
function nameCandidates(text) {
  const t = String(text || '').trim()
  const stripped = t.replace(/^(제주특별자치도|제주도|제주시|서귀포시|제주)\s*/, '').trim()
  const first = stripped.split(/[\s,()·]/)[0]
  return [...new Set([t, stripped, first].filter((s) => s && s.length >= 2))].slice(0, 3)
}

// ── 장소 이름 → 좌표가 있는 장소 ─────────────────────────────
// 이 키로 받는 관광공사 데이터에는 성산일출봉·협재·만장굴 같은 유명 장소가 빠져 있고, 키워드 검색은 비슷한 이름의 음식점을 돌려주기도 한다.
// 그래서 정확한 곳부터 차례로 찾는다: ① 내장 대표 명소 → ② 오름 DB → ③ 관광공사(이름이 같거나 관광지) → ④ 카카오 로컬 검색(키가 있을 때)
const norm = (s) => String(s ?? '').replace(/[\s()[\]·\-_,]/g, '').toLowerCase()
const GAZETTEER = Object.values(FALLBACK_SPOTS).flat()
const ATTRACTION = new Set(['12', '14', '15', '28'])

function fromGazetteer(q) {
  const n = norm(q)
  if (n.length < 2) return null
  const exact = GAZETTEER.find((s) => norm(s.title) === n)
  if (exact) return exact
  if (n.length < 3) return null
  return GAZETTEER.filter((s) => { const t = norm(s.title); return t.length >= 3 && (n.includes(t) || t.includes(n)) })
    .sort((a, b) => b.title.length - a.title.length)[0] ?? null
}

async function fromOreum(q) {
  const n = norm(q)
  if (n.length < 2) return null
  const list = await listHubPlaces({ kind: 'oreum' }).catch(() => [])
  return list.find((p) => norm(p.title) === n)
    ?? (/(오름|봉|악|굼부리)$/.test(String(q).trim()) ? list.find((p) => norm(p.title).includes(n)) : null) ?? null
}

async function fromTour(q) {
  const n = norm(q)
  const list = (await searchPlaces({ keyword: q, rows: 8 }).catch(() => [])).filter((p) => inJeju(p.lat, p.lng))
  // 이름이 정확히 같으면 무엇이든, 아니면 관광지류만 (음식점 "성산일출봉점" 이 성산일출봉으로 잡히는 일을 막는다)
  return list.find((p) => norm(p.title) === n) ?? list.find((p) => ATTRACTION.has(String(p.type)) && norm(p.title).includes(n)) ?? null
}

export async function resolvePlace(...texts) {
  for (const text of texts) {
    for (const keyword of nameCandidates(text)) {
      const hit = await cached(`resolve:${norm(keyword)}`, 60 * 60e3, async () =>
        fromGazetteer(keyword) ?? (await fromOreum(keyword)) ?? (await fromTour(keyword)) ?? (await kakaoPlace(keyword).catch(() => null)) ?? null)
      if (hit) return hit
    }
  }
  return null
}
