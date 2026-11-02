import { useCallback, useEffect, useRef, useState } from 'react'

// 음성으로 질문하기 — 브라우저 내장 음성 인식(Web Speech API)을 쓴다. 서버·API 키·카카오 설정이 필요 없다.
//  · 처음 누르면 브라우저가 "마이크 허용" 창을 띄운다 (HTTPS 또는 localhost 에서만 동작)
//  · 크롬·엣지·안드로이드 크롬·사파리(일부)에서 지원되고, 파이어폭스는 지원되지 않는다
export const SPEECH_LANGS = [
  { code: 'ko-KR', label: '한국어', hint: '말씀해 보세요…' },
  { code: 'en-US', label: 'English', hint: 'Listening…' },
  { code: 'zh-CN', label: '中文', hint: '请说话…' },
  { code: 'ja-JP', label: '日本語', hint: '話してください…' },
]

// 브라우저 언어로 기본값 추정
export function defaultSpeechLang() {
  try {
    const saved = localStorage.getItem('jp-speech-lang')
    if (SPEECH_LANGS.some((l) => l.code === saved)) return saved
  } catch { /* 저장소를 못 쓰는 환경 */ }
  const n = (typeof navigator !== 'undefined' && navigator.language) || ''
  return SPEECH_LANGS.find((l) => n.toLowerCase().startsWith(l.code.slice(0, 2)))?.code ?? 'ko-KR'
}

// onInterim(text): 말하는 도중 실시간 문장 / onFinal(text): 말이 끝났을 때 최종 문장 / onError(code): 오류 코드
export function useSpeech({ lang, onInterim, onFinal, onError }) {
  const rec = useRef(null)
  const [listening, setListening] = useState(false)
  const supported = typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)

  const stop = useCallback(() => { rec.current?.stop() }, [])

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return onError?.('unsupported')
    const r = new SR()
    r.lang = lang
    r.interimResults = true
    r.continuous = false // 한 문장을 말하고 잠시 멈추면 자동으로 끝난다
    r.maxAlternatives = 1

    let finalText = ''
    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText += t
        else interim += t
      }
      onInterim?.(finalText + interim)
    }
    r.onerror = (e) => onError?.(e.error)
    r.onend = () => {
      setListening(false)
      rec.current = null
      if (finalText.trim()) onFinal?.(finalText.trim())
    }

    rec.current = r
    setListening(true)
    try { r.start() } catch { setListening(false); rec.current = null }
  }, [lang, onInterim, onFinal, onError])

  useEffect(() => () => rec.current?.abort(), [])
  return { supported, listening, start, stop }
}
