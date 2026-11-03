// 카카오 장소·주소 검색 — 좌표가 없는 데이터(둘레길 시점·종점, 숙박 주소)를 지도에 올리기 위해 사용
// 결과는 메모리에 캐시해서 같은 검색을 반복하지 않는다.
import { loadKakao } from '../components/KakaoMap'

const cache = new Map()
const memo = (key, fn) => {
  if (!cache.has(key)) cache.set(key, fn().catch(() => null))
  return cache.get(key)
}

// 키워드 검색 1회 (응답이 없으면 5초 뒤 빈 결과) — 주의: location·radius 옵션을 주면 카카오가 응답하지 않아 쓰지 않는다
async function search(keyword) {
  const kakao = await loadKakao()
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve([]), 5000)
    new kakao.maps.services.Places().keywordSearch(keyword, (data) => { clearTimeout(t); resolve(Array.isArray(data) ? data : []) })
  })
}
const inJeju = (d) => /제주/.test(`${d.address_name} ${d.road_address_name}`)

// 이름으로 제주 안의 장소 찾기 → { lat, lng, name, addr, url } | null
//  "(물찻오름)"·"27지점" 같은 꼬리표는 떼고, 안 나오면 "제주 " 를 붙이거나 마지막 단어를 뺀 이름으로 다시 찾는다
export function findPlace(keyword) {
  return memo(`p:${keyword}`, async () => {
    const clean = String(keyword ?? '').replace(/\(.*?\)/g, '').replace(/\s*\d+\s*지점$/, '').trim()
    if (!clean) return null
    const words = clean.split(/\s+/)
    const tries = [clean, `제주 ${clean}`, ...(words.length > 1 ? [words.slice(0, -1).join(' '), `제주 ${words.slice(0, -1).join(' ')}`] : [])]
    for (const q of tries) {
      const d = (await search(q)).find(inJeju)
      if (d) return { lat: Number(d.y), lng: Number(d.x), name: d.place_name, addr: d.road_address_name || d.address_name, url: d.place_url }
    }
    return null
  })
}

// 숙박시설의 전화번호·카카오맵 페이지 찾기 → { name, phone, addr, url, category, lat, lng } | null
//  사업자 이름("(주)더크라운이앤에스 호텔하니크라운")에서 법인 표기를 떼고, 도로명 주소가 맞는 장소를 우선한다.
const normName = (s) => String(s ?? '').replace(/[\s()[\]·\-_,.]/g, '').toLowerCase()
export function findLodgingInfo(name, addr) {
  const key = `l:${name}|${addr}`
  return memo(key, async () => {
    const clean = String(name ?? '').replace(/\(주\)|\(유\)|\(사\)|\(합\)|주식회사|유한회사|유한책임회사|\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim()
    if (!clean) return null
    const words = clean.split(' ')
    const tries = [...new Set([clean, words.slice(-2).join(' '), words.at(-1), `제주 ${words.slice(-2).join(' ')}`])].filter((q) => q && q.length >= 2)
    const road = String(addr ?? '').split(',')[0].replace(/\(.*?\)/g, '').trim() // "제주특별자치도 제주시 삼성로 10"
    const tail = road.split(' ').slice(-2).join(' ') // "삼성로 10"
    const nn = normName(clean)
    for (const q of tries) {
      const list = (await search(q)).filter(inJeju)
      const same = list.find((d) => tail.length > 3 && String(d.road_address_name).includes(tail)) // 주소가 같은 곳
      // 주소가 같은 곳이 없으면 이름이 충분히 겹치는 숙박 장소 (짧고 흔한 이름은 엉뚱한 곳이 잡히지 않게 건너뛴다)
      const last = normName(words.at(-1))
      const near = list.find((d) => {
        const pn = normName(d.place_name)
        return /숙박|호텔|리조트|펜션|콘도|모텔|게스트|민박|호스텔/.test(d.category_name ?? '') && ((last.length >= 4 && pn.includes(last)) || pn.includes(nn) || (pn.length >= 4 && nn.includes(pn)))
      })
      const d = same ?? near
      if (d) return { name: d.place_name, phone: d.phone || '', addr: d.road_address_name || d.address_name, url: d.place_url, category: d.category_name, lat: Number(d.y), lng: Number(d.x) }
    }
    return null
  })
}

// 주소로 좌표 찾기 → { lat, lng } | null
export function findAddress(address) {
  const clean = String(address ?? '').split(',')[0].replace(/\(.*?\)/g, '').trim() // "…삼성로 10, 호텔 (이도일동)" → "…삼성로 10"
  if (!clean) return Promise.resolve(null)
  return memo(`a:${clean}`, async () => {
    const kakao = await loadKakao()
    return new Promise((resolve) => {
      new kakao.maps.services.Geocoder().addressSearch(clean, (data, status) => {
        const d = status === kakao.maps.services.Status.OK ? data[0] : null
        resolve(d ? { lat: Number(d.y), lng: Number(d.x) } : null)
      })
    })
  })
}

// 카카오맵 웹 링크 (앱·웹에서 바로 열림)
export const mapSearchLink = (q) => `https://map.kakao.com/link/search/${encodeURIComponent(q)}`
export const mapToLink = (name, lat, lng) => `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`
export const mapWalkLink = (a, b) =>
  `https://map.kakao.com/link/by/walk/${encodeURIComponent(a.name)},${a.lat},${a.lng}/${encodeURIComponent(b.name)},${b.lat},${b.lng}`
