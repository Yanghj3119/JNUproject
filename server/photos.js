// 한국관광공사 관광사진 정보_GW (PhotoGalleryService1)
// 주의: gallerySearchList1 / galleryDetailList1 의 파라미터·필드명은 활용가이드로 한 번 더 확인하세요
import { callApi, toList, tourParams, https } from './lib.js'
import { resolvePlace, getPlaceDetail } from './tour.js'

const BASE = 'https://apis.data.go.kr/B551011/PhotoGalleryService1'

const norm = (p) => ({
  id: String(p.galContentId ?? ''),
  title: p.galTitle ?? '',
  image: https(p.galWebImageUrl),
  month: p.galPhotographyMonth ?? '',
  location: p.galPhotographyLocation ?? '',
  photographer: p.galPhotographer ?? '',
  keywords: p.galSearchKeyword ?? '',
})

const isJeju = (p) => /제주|서귀포|한라|성산|애월|우도/.test(`${p.title} ${p.location} ${p.keywords}`)

// ① search_photos — 키워드로 제주 관광사진 검색
export async function searchPhotos({ keyword = '', rows = 12, page = 1 } = {}) {
  rows = Math.min(Number(rows) || 12, 40)
  const kw = String(keyword).trim()
  const query = async (k) => toList(await callApi(`${BASE}/gallerySearchList1`, tourParams({
    keyword: k, numOfRows: rows * 3, pageNo: page, arrange: 'A',
  }))).map(norm)

  let list = await query(kw ? `제주 ${kw}` : '제주')
  if (kw && list.length < rows) list = list.concat((await query(kw)).filter(isJeju)) // 제주 접두어로 부족하면 보충

  const seen = new Set()
  return list.filter((p) => p.image && !seen.has(p.id || p.image) && seen.add(p.id || p.image)).slice(0, rows)
}

// ② get_photo_info — 촬영지·촬영시기 + 같은 제목 사진들 + 촬영지의 실제 관광지(좌표)
export async function getPhotoInfo({ title = '', location = '', id = '' } = {}) {
  if (!title && !location) throw new Error('title 또는 location 이 필요해요')

  let gallery = []
  try {
    gallery = toList(await callApi(`${BASE}/galleryDetailList1`, tourParams({ title, numOfRows: 10, pageNo: 1 }))).map(norm)
  } catch { /* 상세가 실패해도 장소 정보는 계속 */ }

  const photo = gallery.find((g) => g.id === String(id)) ?? gallery[0] ?? { id, title, location, image: '', month: '', photographer: '', keywords: '' }
  const place = await resolvePlace(photo.location || location, photo.title || title)
  let detail = null
  if (place) { try { detail = await getPlaceDetail({ contentId: place.id }) } catch { /* 개요 없이 진행 */ } }

  return { photo, gallery, place: place ? { ...place, ...detail } : null }
}
