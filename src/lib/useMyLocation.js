import { useCallback, useState } from 'react'

// 내 위치 찾기 — 브라우저 위치 권한(HTTPS 또는 localhost 에서만). 제주 밖이면 지도에 표시하지 않고 안내만 한다.
export const inJejuArea = (p) => p.lat >= 33 && p.lat <= 34 && p.lng >= 126 && p.lng <= 127.1

export function useMyLocation() {
  const [me, setMe] = useState(null) // { lat, lng } | null
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const locate = useCallback(() => {
    setMsg('')
    if (!navigator.geolocation) return setMsg('이 브라우저는 위치 기능을 지원하지 않아요.')
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setBusy(false)
        const here = { lat: p.coords.latitude, lng: p.coords.longitude }
        if (!inJejuArea(here)) setMsg('현재 위치가 제주 밖이라 지도에 표시할 수 없어요.')
        else setMe(here)
      },
      (e) => { setBusy(false); setMsg(e.code === 1 ? '위치 권한이 거부됐어요. 주소창의 자물쇠 아이콘에서 위치를 허용해 주세요.' : '현재 위치를 알 수 없어요. 잠시 뒤 다시 시도해 주세요.') },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  }, [])

  const clear = useCallback(() => { setMe(null); setMsg('') }, [])
  // 이미 표시 중이면 끄고(기존 보기로 돌아감), 아니면 찾는다
  const toggle = useCallback(() => (me ? clear() : locate()), [me, clear, locate])

  return { me, busy, msg, locate, clear, toggle }
}
