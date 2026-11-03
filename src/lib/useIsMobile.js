import { useEffect, useState } from 'react'

// 화면 폭이 767px 이하(휴대폰)인지 — 모바일에서만 목록을 짧게 보여 줄 때 쓴다
export function useIsMobile() {
  const q = '(max-width: 767px)'
  const [m, setM] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false))
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return m
}
