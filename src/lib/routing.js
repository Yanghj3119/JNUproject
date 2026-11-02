// 실제 도로·길을 따라가는 경로 — OpenStreetMap 기반 무료 경로 서비스(OSRM). API 키가 필요 없다.
//  · driving: 자동차 경로 (AI 코스)   · foot: 도보 경로 (한라산 둘레길)
// 서비스가 느리거나 실패하면 null 을 돌려주고, 지도는 직선으로 대신 보여 준다.
const SERVICES = {
  driving: ['https://routing.openstreetmap.de/routed-car/route/v1/driving', 'https://router.project-osrm.org/route/v1/driving'],
  foot: ['https://routing.openstreetmap.de/routed-foot/route/v1/foot'],
}

const cache = new Map() // 같은 경로를 다시 요청하지 않는다

async function request(base, pts) {
  const coords = pts.map((p) => `${Number(p.lng).toFixed(5)},${Number(p.lat).toFixed(5)}`).join(';')
  const r = await fetch(`${base}/${coords}?overview=full&geometries=geojson`, { signal: AbortSignal.timeout(12000) })
  const j = await r.json()
  const rt = j?.routes?.[0]
  if (!r.ok || j?.code !== 'Ok' || !rt) throw new Error(j?.message || `경로 서비스 오류 (${r.status})`)
  return {
    path: rt.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
    km: Math.round(rt.distance / 100) / 10,
    min: Math.round(rt.duration / 60),
  }
}

export function roadRoute(points, profile = 'driving') {
  const pts = (points ?? []).filter((p) => Number(p?.lat) && Number(p?.lng)).slice(0, 10)
  if (pts.length < 2 || !SERVICES[profile]) return Promise.resolve(null)
  const key = profile + pts.map((p) => `${Number(p.lng).toFixed(5)},${Number(p.lat).toFixed(5)}`).join(';')
  if (!cache.has(key)) {
    cache.set(key, (async () => {
      for (const base of SERVICES[profile]) {
        try { return await request(base, pts) } catch { /* 다음 서비스로 */ }
      }
      return null
    })().then((res) => { if (!res) cache.delete(key); return res })) // 실패는 저장하지 않아 다시 시도할 수 있다
  }
  return cache.get(key)
}
