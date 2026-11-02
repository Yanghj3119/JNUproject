import { useEffect, useRef, useState } from 'react'
import { typeMeta } from '../lib/format'
import { roadRoute } from '../lib/routing'

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
      reject(new Error(`카카오맵을 불러오지 못했어요. 사용 중인 키 ${kakaoKeyHint} — ① 카카오 콘솔의 "JavaScript 키" 끝자리와 같은지(REST API 키·어드민 키는 안 됨) ② 그 키의 "JavaScript SDK 도메인"에 ${window.location.origin} 이 등록됐는지 ③ 제품 설정에서 '카카오맵' 사용이 ON 인지 확인하세요. (Vercel 미리보기·브랜치 주소는 정식 주소와 달라서 따로 등록해야 해요. 정식 도메인으로 접속하면 한 번만 등록하면 됩니다)`))
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
//  · profile: 'driving' | 'foot' 를 주면 직선 대신 실제 도로·길을 따라 선을 그린다 (onRoad 로 거리·시간을 알려 준다)
//  · links: 점선으로 잇는 선(항로) / labels: 모든 핀에 이름 표시
//  · numbered: false 면 정류장처럼 점이 많은 경로를 번호 대신 점으로 그린다 / waypoints: 도로 경로에 쓸 최대 경유지 수
export default function KakaoMap({ spots = [], route, selectedId, onSelect = () => {}, height = '100%', level = 10, profile, onRoad, numbered = true, waypoints = 10, links = [], labels = false }) {
  const box = useRef(null)
  const fitKey = useRef('')
  const map = useRef(null)
  const drawn = useRef([])
  const [error, setError] = useState(null)
  const [ready, setReady] = useState(false)
  const [road, setRoad] = useState(null) // { path, km, min } — 실제 경로
  const onRoadRef = useRef(onRoad)
  onRoadRef.current = onRoad

  const routeKey = route?.length ? route.map((s) => `${s.lat},${s.lng}`).join('|') : ''
  useEffect(() => {
    setRoad(null)
    onRoadRef.current?.(null)
    if (!profile || !routeKey) return
    let alive = true
    roadRoute(route, profile, waypoints).then((r) => {
      if (!alive || !r) return
      setRoad(r)
      onRoadRef.current?.({ km: r.km, min: r.min })
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey, profile])

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
      // 실제 경로가 있으면 그 길을 따라 그리고, 없으면(불러오는 중·실패) 점선 직선
      const line = road?.path?.length ? road.path.map((p) => new kakao.maps.LatLng(p.lat, p.lng)) : path
      line.forEach((p) => bounds.extend(p))
      add(new kakao.maps.Polyline({ path: line, strokeWeight: road ? 5 : 3, strokeColor: '#0e6f7a', strokeOpacity: road ? 0.9 : 0.7, strokeStyle: road ? 'solid' : 'shortdash' }))
      route.forEach((s, i) => {
        const el = document.createElement('div')
        const edge = i === 0 || i === route.length - 1
        if (numbered || edge) {
          el.className = 'jp-num'
          el.textContent = numbered ? String(i + 1) : (i === 0 ? '기' : '종') // 정류장이 많은 노선은 번호 대신 점, 처음·끝만 글자로
        } else el.className = 'jp-dot'
        el.title = s.name
        add(new kakao.maps.CustomOverlay({ position: path[i], content: el, yAnchor: 0.5, zIndex: edge ? 5 : 3 }))
      })
      // 지도 범위는 노선이 바뀔 때만 맞춘다 (버스 위치가 갱신될 때마다 지도가 움직이지 않게)
      if (fitKey.current !== routeKey) {
        fitKey.current = routeKey
        if (path.length > 1) map.current.setBounds(bounds, 40, 40, 40, 40)
        else { map.current.setCenter(path[0]); map.current.setLevel(5) }
      }
    }

    // 점선으로 잇는 선 (항로처럼 출발지 → 목적지): [[{lat,lng},{lat,lng}], …]
    links.forEach((pair) => {
      const lp = pair.map((p) => new kakao.maps.LatLng(p.lat, p.lng))
      lp.forEach((p) => bounds.extend(p))
      add(new kakao.maps.Polyline({ path: lp, strokeWeight: 3, strokeColor: '#0369a1', strokeOpacity: 0.8, strokeStyle: 'shortdash' }))
    })

    spots.forEach((s) => {
      const pos = new kakao.maps.LatLng(s.lat, s.lng)
      bounds.extend(pos)
      const sel = String(s.id) === String(selectedId)
      const el = document.createElement('div')
      el.className = `jp-kpin ${sel ? 'sel' : ''}`
      el.style.setProperty('--c', typeMeta(s.type).color)
      el.title = s.title
      el.innerHTML = sel || labels ? `<span>${String(s.title).replace(/[<>&]/g, '')}</span>` : ''
      el.onclick = () => onSelect(s)
      add(new kakao.maps.CustomOverlay({ position: pos, content: el, yAnchor: 1, zIndex: sel ? 10 : 1 }))
    })

    if (route?.length) return // 경로 위에 핀을 겹쳐 그린 경우(버스 위치 등)는 위에서 맞춘 범위를 그대로 둔다
    const chosen = spots.find((s) => String(s.id) === String(selectedId))
    if (chosen) map.current.panTo(new kakao.maps.LatLng(chosen.lat, chosen.lng))
    else if (spots.length === 1) { map.current.setCenter(new kakao.maps.LatLng(spots[0].lat, spots[0].lng)); map.current.setLevel(4) }
    else if (spots.length > 1 || links.length) map.current.setBounds(bounds, 40, 40, 40, 40)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, spots, route, selectedId, road, links, labels])

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
