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

// 로그인 사용자 표시 이름 — 이메일 가입(name), 카카오 로그인(name/nickname 등)을 모두 처리
export const displayName = (user) => {
  const m = user?.user_metadata ?? {}
  return m.name || m.full_name || m.nickname || m.user_name || user?.email?.split('@')[0] || '회원'
}

export const distLabel = (m) => (m == null ? '' : m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`)

// 사진 상세 페이지 주소 — 새로고침해도 다시 조회할 수 있게 제목·촬영지를 쿼리로 담는다
export function photoLink(p) {
  const q = new URLSearchParams({ title: p.title ?? '', loc: p.location ?? '', img: p.image ?? '' })
  return `/photo/${encodeURIComponent(p.id || 'x')}?${q}`
}

// 장소 분류별 색·아이콘. 핀 색은 푸른 계열로 통일
export const TYPE_META = {
  12: { label: '관광지', color: '#2563eb', icon: 'camera' },
  14: { label: '문화시설', color: '#4f46e5', icon: 'bank' },
  15: { label: '축제·행사', color: '#0ea5e9', icon: 'balloon' },
  28: { label: '레포츠', color: '#0284c7', icon: 'bicycle' },
  32: { label: '숙박', color: '#3b82f6', icon: 'house' },
  38: { label: '쇼핑', color: '#06b6d4', icon: 'bag' },
  39: { label: '음식점', color: '#0891b2', icon: 'cup-hot' },
  // 제주데이터허브 (문자 키)
  oreum: { label: '오름', color: '#1d4ed8', icon: 'triangle' },
  museum: { label: '박물관·미술관', color: '#6366f1', icon: 'bank2' },
  souvenir: { label: '기념품', color: '#38bdf8', icon: 'bag-heart' },
  rentcar: { label: '렌터카', color: '#0369a1', icon: 'car-front' },
  socar: { label: '쏘카존', color: '#0ea5e9', icon: 'ev-front' },
  busstop: { label: '버스 정류소', color: '#1f7ae0', icon: 'bus-front' },
}
export const typeMeta = (t) => TYPE_META[t] ?? TYPE_META[Number(t)] ?? { label: '명소', color: '#2563eb', icon: 'geo-alt' }

export const SKY_ICON = { 맑음: 'brightness-high', 구름많음: 'cloud-sun', 흐림: 'cloud' }
export const skyIcon = (w) => (w?.rainy ? 'cloud-rain' : (SKY_ICON[w?.sky] ?? 'cloud-sun'))
