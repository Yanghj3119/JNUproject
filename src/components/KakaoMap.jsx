import { useEffect, useRef, useState } from 'react'
import { typeMeta } from '../lib/format'

const KEY = import.meta.env.VITE_KAKAO_MAP_KEY
export const hasKakaoKey = Boolean(KEY)

// 카카오맵 SDK 를 한 번만 불러온다
let sdk
function loadKakao() {
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao)
  sdk ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KEY}&autoload=false`
    s.onload = () => window.kakao.maps.load(() => resolve(window.kakao))
    s.onerror = () => { sdk = null; reject(new Error('카카오맵을 불러오지 못했어요. 키와 허용 도메인(Web 플랫폼)을 확인하세요.')) }
    document.head.appendChild(s)
  })
  return sdk
}

// spots: [{id,title,lat,lng,type}] — 선택하면 onSelect(spot). 장소 1곳만 보여 줄 때는 spots 에 1개, interactive={false}
export default function KakaoMap({ spots = [], selectedId, onSelect = () => {}, height = '100%', level = 10 }) {
  const box = useRef(null)
  const map = useRef(null)
  const overlays = useRef([])
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
    overlays.current.forEach((o) => o.setMap(null))
    overlays.current = []
    const bounds = new kakao.maps.LatLngBounds()

    spots.forEach((s) => {
      const pos = new kakao.maps.LatLng(s.lat, s.lng)
      bounds.extend(pos)
      const sel = String(s.id) === String(selectedId)
      const el = document.createElement('div')
      el.className = `jp-kpin ${sel ? 'sel' : ''}`
      el.style.setProperty('--c', typeMeta(s.type).color)
      el.title = s.title
      el.innerHTML = sel ? `<span>${s.title.replace(/[<>&]/g, '')}</span>` : ''
      el.onclick = () => onSelect(s)
      const ov = new kakao.maps.CustomOverlay({ position: pos, content: el, yAnchor: 1, zIndex: sel ? 10 : 1 })
      ov.setMap(map.current)
      overlays.current.push(ov)
    })

    const chosen = spots.find((s) => String(s.id) === String(selectedId))
    if (chosen) map.current.panTo(new kakao.maps.LatLng(chosen.lat, chosen.lng))
    else if (spots.length === 1) { map.current.setCenter(new kakao.maps.LatLng(spots[0].lat, spots[0].lng)); map.current.setLevel(4) }
    else if (spots.length > 1) map.current.setBounds(bounds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, spots, selectedId])

  if (!hasKakaoKey) {
    return (
      <div className="d-grid place-items-center text-center text-muted p-4" style={{ height, background: '#eef6fa' }}>
        <div>
          <i className="bi bi-map display-5 text-jp" />
          <p className="mt-2 mb-0 small">카카오 지도 키(<code>VITE_KAKAO_MAP_KEY</code>)를 넣으면 실제 지도가 보여요.</p>
        </div>
      </div>
    )
  }
  if (error) return <div className="alert alert-warning m-3 small">{error}</div>
  return <div ref={box} style={{ width: '100%', height }} />
}
