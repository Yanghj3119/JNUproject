// 한국관광공사 국문 관광정보 서비스_GW (KorService2)
import { callApi, toList, tourParams, https, stripHtml, inJeju } from './lib.js'

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
export async function listSpots({ type = '12', rows = 40 } = {}) {
  const body = await callApi(`${BASE}/areaBasedList2`, tourParams({
    areaCode: 39, contentTypeId: type, numOfRows: Math.min(Number(rows) || 40, 100), pageNo: 1, arrange: 'Q',
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

export async function resolvePlace(...texts) {
  for (const text of texts) {
    for (const keyword of nameCandidates(text)) {
      const hit = (await searchPlaces({ keyword, rows: 5 })).find((p) => inJeju(p.lat, p.lng))
      if (hit) return hit
    }
  }
  return null
}
