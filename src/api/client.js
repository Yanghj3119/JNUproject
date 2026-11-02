// React 화면이 우리 서버 함수(/api/...)를 부를 때 쓰는 함수 모음
// 공공데이터 API를 브라우저에서 직접 부르지 않습니다 (키 노출 + CORS 문제) → 반드시 /api 를 거칩니다.

async function readJson(r) {
  let data
  try { data = await r.json() }
  catch { throw new Error(`서버 응답이 JSON이 아님 (${r.status})`) }
  if (!r.ok) throw new Error(data.error || r.statusText)
  return data
}

const qs = (o = {}) =>
  new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '')).toString()

export const get = (path, params) => fetch(params ? `${path}?${qs(params)}` : path).then(readJson)
export const post = (path, body) =>
  fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(readJson)

// 공공데이터 API
export const fetchPhotos = (keyword = '', rows = 12) => get('/api/photos', { keyword, rows })          // search_photos
export const fetchPhotoInfo = ({ id, title, location }) => get('/api/photo', { id, title, location })   // get_photo_info
export const fetchNearby = ({ lat, lng, radius = 3000, type, exclude }) => get('/api/nearby', { lat, lng, radius, type, exclude }) // find_nearby
export const fetchWeather = ({ place, lat, lng } = {}) => get('/api/weather', { place, lat, lng })
export const fetchSpots = (type = '12', page, rows) => get('/api/spots', { type, page, rows })
export const fetchAccess = ({ contentId, name }) => get('/api/place', { kind: 'access', contentId, name })
export const fetchRelated = ({ name, addr }) => get('/api/place', { kind: 'related', name, addr })
export const fetchCrowd = ({ name, addr }) => get('/api/place', { kind: 'crowd', name, addr })

// 제주데이터허브: kind = trail | accident | busstop | busroute | lodging
export const fetchHub = (kind, params = {}) => get('/api/hub', { kind, ...params })

// 대중교통·공항: kind = stops | arrivals | routes | positions | flights
export const fetchTransit = (kind, params = {}) => get('/api/transit', { kind, ...params })

// 연결 점검 · 에이전트
export const fetchHealth = () => get('/api/health')
export const askAgent = (message, history) => post('/api/agent', { message, history })
