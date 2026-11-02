import { useEffect, useRef, useState } from 'react'
import { Container } from 'react-bootstrap'
import { useAppStore } from '../store/useAppStore'
import PageHeader from '../components/PageHeader'

const TOOL_LABEL = {
  search_photos: ['images', '사진 검색'],
  get_photo_info: ['calendar-heart', '촬영지·시기'],
  find_nearby: ['signpost-split', '주변 명소'],
  get_weather: ['cloud-sun', '날씨'],
  check_accessibility: ['universal-access', '무장애 정보'],
  get_related_places: ['diagram-3', '연관 관광지'],
  get_crowd_forecast: ['people', '혼잡도 예측'],
}

const SUGGESTIONS = [
  '성산일출봉 근처에서 반나절 코스 추천해줘',
  '비 오는 날 서귀포에서 갈 만한 곳은?',
  '휠체어로 갈 수 있는 제주 명소 알려줘',
  '유채꽃 사진 찍힌 곳은 어디고, 언제 가야 해?',
]

export default function Agent() {
  const { messages, chatLoading, sendMessage, clearChat } = useAppStore()
  const [text, setText] = useState('')
  const end = useRef(null)

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, chatLoading])

  const send = (t) => {
    const v = (t ?? text).trim()
    if (!v || chatLoading) return
    setText('')
    sendMessage(v)
  }

  return (
    <Container style={{ maxWidth: 820 }}>
      <PageHeader icon="chat-heart" title="AI 제주 가이드" sub="사진·날씨·주변 명소·접근성을 AI가 직접 도구로 확인해서 답해요.">
        {messages.length > 0 && <button className="btn btn-sm btn-outline-secondary rounded-pill" onClick={clearChat}><i className="bi bi-trash me-1" />대화 지우기</button>}
      </PageHeader>

      <div className="jp-chat">
        <div className="jp-chat-log">
          {messages.length === 0 && (
            <div className="text-center text-muted my-auto">
              <div className="display-5">🍊</div>
              <p className="mb-3">무엇이든 물어보세요. 이렇게요!</p>
              <div className="d-flex flex-wrap gap-2 justify-content-center">
                {SUGGESTIONS.map((s) => <button key={s} className="jp-month" onClick={() => send(s)}>{s}</button>)}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`jp-bubble ${m.role}`}>
              {m.text}
              {m.steps?.length > 0 && (
                <div className="mt-2 pt-2 border-top">
                  <div className="small text-muted mb-1">AI가 호출한 도구</div>
                  {m.steps.map((s, j) => {
                    const [icon, label] = TOOL_LABEL[s.tool] ?? ['tools', s.tool]
                    const arg = Object.values(s.args ?? {}).filter((v) => typeof v === 'string').join(' ')
                    return (
                      <span key={j} className={`jp-step ${s.error ? 'err' : ''}`} title={s.error || JSON.stringify(s.args)}>
                        <i className={`bi bi-${icon}`} />{label}{arg && ` · ${arg}`}{s.count != null && ` (${s.count}건)`}{s.error && ' ⚠'}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
          {chatLoading && <div className="jp-bubble assistant text-muted"><span className="spinner-border spinner-border-sm me-2" />도구로 확인하는 중…</div>}
          <div ref={end} />
        </div>

        <form className="jp-chat-form" onSubmit={(e) => { e.preventDefault(); send() }}>
          <input className="form-control rounded-pill" placeholder="제주 여행에 대해 물어보세요" value={text} onChange={(e) => setText(e.target.value)} disabled={chatLoading} />
          <button className="btn btn-primary px-4" disabled={chatLoading || !text.trim()}><i className="bi bi-send" /></button>
        </form>
      </div>
    </Container>
  )
}
