import { useEffect, useRef, useState } from 'react'
import { typeMeta } from '../lib/format'

const KEY = import.meta.env.VITE_KAKAO_MAP_KEY
export const hasKakaoKey = Boolean(KEY)
// 어떤 키가 쓰이는지 확인용 — 끝 4자리만 보여 준다 (카카오 콘솔의 JavaScript 키 끝자리와 비교)
export const kakaoKeyHint = KEY ? `…${KEY.slice(-4)}` : ''

// 카카오맵 SDK 를 한 번만 불러온다
let sdk
export function loadKakao() {
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao)
  sdk ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    // services: 장소·주소 검색(좌표 찾기)에 필요한 라이브러리
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&autoload=false&libraries=services`
    s.onload = () => window.kakao.maps.load(() => resolve(window.kakao))
    s.onerror = () => {
      sdk = null
      reject(new Error(`카카오맵을 불러오지 못했어요. 사용 중인 키 ${kakaoKeyHint} — ① 카카오 콘솔의 "JavaScript 키" 끝자리와 같은지(REST API 키·어드민 키는 안 됨) ② 그 키의 "JavaScript SDK 도메인"에 ${window.location.origin} 이 등록됐는지 ③ 제품 설정에서 '카카오맵' 사용이 ON 인지 확인하세요.`))
    }
    document.head.appendChild(s)
  })
  return sdk
}

// /status 용 진단: 실제로 SDK 를 불러 보고 결과를 돌려준다
export function checkKakao() {
  if (!KEY) return Promise.resolve({ ok: false, message: 'VITE_KAKAO_MAP_KEY 가 없어요 (Vercel 은 환경변수 등록 후 Redeploy 필요)' })
  return loadKakao().then(() => ({ ok: true, message: '' })).catch((e) => ({ ok: false, message: e.message }))
}

// 두 가지 모드
//  · spots: 핀 여러 개 (선택하면 onSelect)       — 지도 페이지·사진 상세
//  · route: [{lat,lng,name}] 순서대로 번호 핀 + 선 — AI 가이드 코스·내 경로
export default function KakaoMap({ spots = [], route, selectedId, onSelect = () => {}, height = '100%', level = 10 }) {
  const box = useRef(null)
  const map = useRef(null)
  const drawn = useRef([])
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!hasKakaoKey) return
    let alive = true
    loadKakao().then((kakao) => {
      if (!alive || !box.current) return
      map.current = new kakao.maps.Map(box.current, { center: new kakao.maps.LatLng(33.38, 126.55), level })
      setReady(true)
    }).catch((e) => alive && setError(e.message))
    return () => { alive = false }
  }, [level])

  useEffect(() => {
    if (!ready) return
    const kakao = window.kakao
    drawn.current.forEach((o) => o.setMap(null))
    drawn.current = []
    const bounds = new kakao.maps.LatLngBounds()
    const add = (obj) => { obj.setMap(map.current); drawn.current.push(obj) }

    if (route?.length) {
      const path = route.map((s) => new kakao.maps.LatLng(s.lat, s.lng))
      path.forEach((p) => bounds.extend(p))
      add(new kakao.maps.Polyline({ path, strokeWeight: 4, strokeColor: '#0e6f7a', strokeOpacity: 0.85, strokeStyle: 'solid' }))
      route.forEach((s, i) => {
        const el = document.createElement('div')
        el.className = 'jp-num'
        el.textContent = String(i + 1)
        el.title = s.name
        add(new kakao.maps.CustomOverlay({ position: path[i], content: el, yAnchor: 0.5, zIndex: 5 }))
      })
      if (path.length > 1) map.current.setBounds(bounds, 40, 40, 40, 40)
      else { map.current.setCenter(path[0]); map.current.setLevel(5) }
      return
    }

    spots.forEach((s) => {
      const pos = new kakao.maps.LatLng(s.lat, s.lng)
      bounds.extend(pos)
      const sel = String(s.id) === String(selectedId)
      const el = document.createElement('div')
      el.className = `jp-kpin ${sel ? 'sel' : ''}`
      el.style.setProperty('--c', typeMeta(s.type).color)
      el.title = s.title
      el.innerHTML = sel ? `<span>${String(s.title).replace(/[<>&]/g, '')}</span>` : ''
      el.onclick = () => onSelect(s)
      add(new kakao.maps.CustomOverlay({ position: pos, content: el, yAnchor: 1, zIndex: sel ? 10 : 1 }))
    })

    const chosen = spots.find((s) => String(s.id) === String(selectedId))
    if (chosen) map.current.panTo(new kakao.maps.LatLng(chosen.lat, chosen.lng))
    else if (spots.length === 1) { map.current.setCenter(new kakao.maps.LatLng(spots[0].lat, spots[0].lng)); map.current.setLevel(4) }
    else if (spots.length > 1) map.current.setBounds(bounds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, spots, route, selectedId])

  if (!hasKakaoKey) {
    return (
      <div className="d-grid text-center text-muted p-4" style={{ height, background: '#eef3f4', placeItems: 'center' }}>
        <div>
          <i className="bi bi-map fs-1 text-jp" />
          <p className="mt-2 mb-0 small">카카오 지도 키(<code>VITE_KAKAO_MAP_KEY</code>)를 넣으면 지도가 보여요.</p>
        </div>
      </div>
    )
  }
  if (error) return <div className="alert alert-warning m-3 small">{error}</div>
  return <div ref={box} style={{ width: '100%', height }} />
}
