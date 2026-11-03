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
// 좌표는 소수점을 줄여(약 100m) 보내서, 같은 동네의 요청이 같은 주소가 되어 서버 캐시를 함께 쓴다 (공공데이터 일일 호출 한도 절약)
const rd = (v, d) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? v : Math.round(Number(v) * 10 ** d) / 10 ** d)
export const fetchNearby = ({ lat, lng, radius = 3000, type, exclude }) => get('/api/nearby', { lat: rd(lat, 3), lng: rd(lng, 3), radius, type, exclude }) // find_nearby
export const fetchWeather = ({ place, lat, lng } = {}) => get('/api/weather', { place, lat: rd(lat, 2), lng: rd(lng, 2) }) // 기상청 격자는 5km 라서 소수점 2자리면 충분
export const fetchSpots = (type = '12', page, rows) => get('/api/spots', { type, page, rows })
export const fetchAccess = ({ contentId, name }) => get('/api/place', { kind: 'access', contentId, name })
export const fetchRelated = ({ name, addr }) => get('/api/place', { kind: 'related', name, addr })
export const fetchCrowd = ({ name, addr }) => get('/api/place', { kind: 'crowd', name, addr })

// 제주데이터허브: kind = trail | lodging
export const fetchHub = (kind, params = {}) => get('/api/hub', { kind, ...params })

// 대중교통·공항: kind = stops | arrivals | routes | positions | flights
export const fetchTransit = (kind, params = {}) => get('/api/transit', { kind, ...params })

// 연결 점검 · 에이전트
export const fetchHealth = () => get('/api/health')
// 미니앨범 제목·문구 (사진은 저장되지 않음). options: { tone, hints:[{place,date}] }
export const makeAlbumCaptions = (images, options = {}) => post('/api/album', { images, ...options })
// 사진 AI 편집: 로그인 토큰을 같이 보내 서버가 사용 횟수(1인 하루 10회)를 센다
export async function editPhotoWithAi({ text, edit, image, history }) {
  const { supabase } = await import('../lib/supabase')
  const token = (await supabase?.auth.getSession())?.data?.session?.access_token
  const r = await fetch('/api/album', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action: 'edit', text, edit, image, history }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) { const e = new Error(data.error || '요청에 실패했어요'); e.left = data.left; throw e }
  return data
}
// 오늘 남은 AI 편집 횟수 (SQL 을 아직 안 만들었거나 로그인 전이면 null)
export async function aiEditLeft() {
  const { supabase } = await import('../lib/supabase')
  if (!supabase) return null
  const { data, error } = await supabase.rpc('ai_edit_left')
  return error || !data?.ok ? null : data
}
export const askAgent =(message, history) => post('/api/agent', { message, history })
