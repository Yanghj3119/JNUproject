// 사진 API 의 촬영월 값에서 월(1~12)만 뽑기
// 지원 형식: 202005 · 20200512 · 2020-05(-12) · 2020.05 · 5월 · 05 · 5
export function monthOf(v) {
  const s = String(v ?? '').trim()
  const ym = s.match(/^(?:19|20)\d{2}\D?(\d{2})/)           // 연도로 시작하면 바로 뒤 두 자리가 월
  const n = ym ? Number(ym[1]) : Number((s.match(/^(\d{1,2})\s*월?$/) ?? [])[1] ?? 0)
  return n >= 1 && n <= 12 ? n : 0
}

// 월 표기는 "N월" 로 통일 (정보가 없으면 빈 문자열)
export const monthLabel = (v) => (monthOf(v) ? `${monthOf(v)}월` : '')

// 매번 다른 사진이 먼저 보이도록 섞고, 같은 제목이 몰리지 않게 제목당 최대 cap 장
export function shuffleDiverse(list = [], cap = 2) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  const seen = {}
  return a.filter((p) => (seen[p.title] = (seen[p.title] ?? 0) + 1) <= cap)
}

const SEASON ={ 3: '봄', 4: '봄', 5: '봄', 6: '여름', 7: '여름', 8: '여름', 9: '가을', 10: '가을', 11: '가을', 12: '겨울', 1: '겨울', 2: '겨울' }
export const seasonOf = (month) => SEASON[month] ?? ''

export const distLabel = (m) => (m == null ? '' : m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`)

// 사진 상세 페이지 주소 — 새로고침해도 다시 조회할 수 있게 제목·촬영지를 쿼리로 담는다
export function photoLink(p) {
  const q = new URLSearchParams({ title: p.title ?? '', loc: p.location ?? '', img: p.image ?? '', m: p.month ?? '' })
  return `/photo/${encodeURIComponent(p.id || 'x')}?${q}`
}

export const TYPE_META = {
  12: { label: '관광지', color: '#ff8a1f', icon: 'camera' },
  14: { label: '문화시설', color: '#7b61ff', icon: 'bank' },
  15: { label: '축제·행사', color: '#ff4d8d', icon: 'balloon' },
  28: { label: '레포츠', color: '#1fa2ff', icon: 'bicycle' },
  32: { label: '숙박', color: '#8d6e63', icon: 'house' },
  38: { label: '쇼핑', color: '#e5b700', icon: 'bag' },
  39: { label: '음식점', color: '#2fb36b', icon: 'cup-hot' },
  // 제주데이터허브 (문자 키)
  oreum: { label: '오름', color: '#3f8f52', icon: 'triangle' },
  museum: { label: '박물관·미술관', color: '#7b61ff', icon: 'bank2' },
  souvenir: { label: '기념품', color: '#c9702a', icon: 'bag-heart' },
  accident: { label: '사고 다발', color: '#d64545', icon: 'exclamation-triangle' },
  busstop: { label: '버스 정류소', color: '#1f7ae0', icon: 'bus-front' },
}
export const typeMeta = (t) => TYPE_META[t] ?? TYPE_META[Number(t)] ?? { label: '명소', color: '#ff8a1f', icon: 'geo-alt' }

export const SKY_ICON = { 맑음: 'brightness-high', 구름많음: 'cloud-sun', 흐림: 'cloud' }
export const skyIcon = (w) => (w?.rainy ? 'cloud-rain' : (SKY_ICON[w?.sky] ?? 'cloud-sun'))
