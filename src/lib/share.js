// 링크 공유: 카카오톡 → 기기 공유창 → 링크 복사 순으로 시도한다.
// 카카오톡 공유는 지도와 같은 JavaScript 키를 쓰며, 카카오 앱의 "JavaScript SDK 도메인"에 사이트 주소가 등록돼 있어야 한다.
const KEY = import.meta.env.VITE_KAKAO_MAP_KEY
export const canKakaoShare = Boolean(KEY)

let sdk
function loadKakaoSdk() {
  if (window.Kakao) return Promise.resolve(window.Kakao)
  sdk ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js'
    s.crossOrigin = 'anonymous'
    s.onload = () => resolve(window.Kakao)
    s.onerror = () => { sdk = null; reject(new Error('카카오 SDK 를 불러오지 못했어요')) }
    document.head.appendChild(s)
  })
  return sdk
}

export async function shareKakao({ title, description, url, imageUrl }) {
  const K = await loadKakaoSdk()
  if (!K.isInitialized()) K.init(KEY)
  K.Share.sendDefault({
    objectType: 'feed',
    content: { title, description, imageUrl, link: { mobileWebUrl: url, webUrl: url } },
    buttons: [{ title: '제주픽에서 보기', link: { mobileWebUrl: url, webUrl: url } }],
  })
}

export async function shareNative({ title, description, url }) {
  await navigator.share({ title, text: description, url })
}

export async function copyLink(url) {
  try { await navigator.clipboard.writeText(url) }
  catch { // 구형 브라우저 대비
    const t = Object.assign(document.createElement('textarea'), { value: url })
    document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove()
  }
}

// ── 코스를 링크 하나에 담기 (서버 저장 없이 누구나 열 수 있는 공유 주소) ──
// 형식: { t: 제목, s: [[이름, 위도, 경도, 메모], ...] } → JSON → UTF-8 → URL-safe base64
const toB64 = (str) => {
  const bytes = new TextEncoder().encode(str)
  let bin = ''
  bytes.forEach((b) => { bin += String.fromCharCode(b) })
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
}
const fromB64 = (b64) => {
  const bin = atob(b64.replaceAll('-', '+').replaceAll('_', '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export function routeShareUrl(route) {
  const payload = {
    t: String(route.title ?? '').slice(0, 40),
    s: (route.stops ?? []).slice(0, 8).map((s) => [
      String(s.name ?? '').slice(0, 30), Number(Number(s.lat).toFixed(5)), Number(Number(s.lng).toFixed(5)), String(s.note ?? '').slice(0, 50),
    ]),
  }
  return `${window.location.origin}/share?d=${toB64(JSON.stringify(payload))}`
}

// 주소의 d 값을 코스로 되돌린다. 누가 만든 값이든 믿지 않고 형식·범위를 검사한다.
export function decodeRoute(d) {
  try {
    const p = JSON.parse(fromB64(String(d)))
    const stops = (Array.isArray(p.s) ? p.s : []).slice(0, 8)
      .map(([name, lat, lng, note]) => ({ name: String(name ?? '').slice(0, 30), lat: Number(lat), lng: Number(lng), note: String(note ?? '').slice(0, 50) }))
      .filter((s) => s.name && s.lat > 33 && s.lat < 33.7 && s.lng > 126 && s.lng < 127.2)
    if (!stops.length) return null
    return { title: String(p.t ?? '제주 코스').slice(0, 40), stops }
  } catch {
    return null
  }
}
