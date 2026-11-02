// 사진 소스 2가지
//  ① 한국관광공사 관광사진 정보_GW (PhotoGalleryService1)
//  ② 한국관광공사 관광공모전(사진) 수상작 정보 (PhokoAwrdService) — 제주(법정동 50) 직접 필터, 촬영일 포함
// 주의: 두 API 의 오퍼레이션·필드명 일부는 활용가이드로 확인 필요 → /api/photos?debug=1 로 원본 응답 확인
import { callApi, toList, tourParams, https } from './lib.js'
import { resolvePlace, getPlaceDetail } from './tour.js'

const GALLERY = 'https://apis.data.go.kr/B551011/PhotoGalleryService1'
const AWARD = 'https://apis.data.go.kr/B551011/PhokoAwrdService'

const norm = (p) => ({
  id: String(p.galContentId ?? ''),
  title: p.galTitle ?? '',
  image: https(p.galWebImageUrl),
  month: p.galPhotographyMonth ?? '',
  location: p.galPhotographyLocation ?? '',
  photographer: p.galPhotographer ?? '',
  keywords: p.galSearchKeyword ?? '',
  source: 'gallery',
})

// 공모전 응답은 필드명을 확정하지 못해, 키 이름 패턴으로 찾아 쓴다
const pick = (o, re) => {
  const k = Object.keys(o).find((x) => re.test(x) && o[x] !== '' && o[x] != null)
  return k ? String(o[k]) : ''
}
const IMG = /^https?:\/\/\S+\.(jpe?g|png|gif|webp)(\?|$)/i
const hash = (s) => [...s].reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0).toString(36)

function normAward(p) {
  const image = Object.values(p).find((v) => typeof v === 'string' && IMG.test(v)) || pick(p, /img|image|url/i)
  const title = pick(p, /title|ttl/i)
  return {
    id: `aw-${pick(p, /(content)?id$|seq|no$/i) || hash(title + image)}`,
    title,
    image: https(image),
    month: pick(p, /film|shot|photo.*(dt|date|ymd)|촬영일/i),
    location: pick(p, /site|place|loc|addr|촬영지/i),
    photographer: pick(p, /photographer|wrtr|author|writer/i),
    keywords: pick(p, /keyword|kwrd/i),
    source: 'award',
  }
}

const isJeju = (p) => /제주|서귀포|한라|성산|애월|우도/.test(`${p.title} ${p.location} ${p.keywords}`)

async function galleryQuery(keyword, pages = 3) {
  const one = (pageNo) => callApi(`${GALLERY}/gallerySearchList1`, tourParams({ keyword, numOfRows: 100, pageNo, arrange: 'A' }))
    .then((b) => toList(b).map(norm)).catch(() => [])
  return (await Promise.all(Array.from({ length: pages }, (_, i) => one(i + 1)))).flat()
}

export async function searchAwardPhotos({ keyword = '', rows = 40 } = {}) {
  const body = await callApi(`${AWARD}/phokoAwrdList`, tourParams({
    lDongRegnCd: 50, keyword, numOfRows: rows, pageNo: 1, arrange: 'Q',
  }))
  return toList(body).map(normAward).filter((p) => p.image)
}

// ① search_photos — 키워드로 제주 관광사진 검색 (두 소스를 섞어서)
export async function searchPhotos({ keyword = '', rows = 12 } = {}) {
  rows = Math.min(Number(rows) || 12, 80)
  const kw = String(keyword).trim()

  const [g1, g2, awards] = await Promise.all([
    galleryQuery(kw ? `제주 ${kw}` : '제주'),
    kw ? galleryQuery(kw, 1).then((l) => l.filter(isJeju)) : Promise.resolve([]), // 제주 접두어로 부족할 때 보충
    searchAwardPhotos({ keyword: kw, rows: Math.min(rows, 50) }).catch(() => []),
  ])

  // 갤러리와 수상작을 번갈아 섞고, 같은 사진은 한 번만
  const gallery = [...g1, ...g2]
  const mixed = []
  for (let i = 0; i < Math.max(gallery.length, awards.length); i++) {
    if (awards[i]) mixed.push(awards[i])
    if (gallery[i]) mixed.push(gallery[i])
  }
  const seen = new Set()
  return mixed
    .filter((p) => p.image && !seen.has(p.image) && seen.add(p.image))
    .slice(0, rows)
}

// 원본 응답 확인용 (/api/photos?debug=1) — 필드명·월 형식 점검
export async function debugPhotos({ keyword = '제주' } = {}) {
  const raw = async (fn) => { try { return await fn() } catch (e) { return { error: e.message } } }
  return {
    gallery: await raw(async () => toList(await callApi(`${GALLERY}/gallerySearchList1`, tourParams({ keyword, numOfRows: 3, pageNo: 1 })))),
    award: await raw(async () => toList(await callApi(`${AWARD}/phokoAwrdList`, tourParams({ lDongRegnCd: 50, numOfRows: 3, pageNo: 1 })))),
  }
}

// ② get_photo_info — 촬영지·촬영시기 + 같은 제목 사진들 + 촬영지의 실제 관광지(좌표)
export async function getPhotoInfo({ title = '', location = '', id = '' } = {}) {
  if (!title && !location) throw new Error('title 또는 location 이 필요해요')

  let gallery = []
  if (!String(id).startsWith('aw-')) {
    try {
      gallery = toList(await callApi(`${GALLERY}/galleryDetailList1`, tourParams({ title, numOfRows: 10, pageNo: 1 }))).map(norm)
    } catch { /* 상세가 실패해도 장소 정보는 계속 */ }
  }

  const photo = gallery.find((g) => g.id === String(id)) ?? gallery[0] ?? { id, title, location, image: '', month: '', photographer: '', keywords: '' }
  const place = await resolvePlace(photo.location || location, photo.title || title)
  let detail = null
  if (place) { try { detail = await getPlaceDetail({ contentId: place.id }) } catch { /* 개요 없이 진행 */ } }

  return { photo, gallery, place: place ? { ...place, ...detail } : null }
}
