import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Container } from 'react-bootstrap'
import { useAppStore } from '../store/useAppStore'
import KakaoMap from '../components/KakaoMap'
import PageBanner from '../components/PageBanner'
import ShareButton from '../components/ShareButton'
import { routeShareUrl } from '../lib/share'

const TOOL_LABEL = {
  search_photos: ['images', '사진 검색'],
  get_photo_info: ['calendar3', '촬영지·시기'],
  find_nearby: ['signpost-split', '주변 명소'],
  get_weather: ['cloud-sun', '날씨'],
  check_accessibility: ['universal-access', '무장애 정보'],
  get_related_places: ['diagram-3', '연관 관광지'],
  get_crowd_forecast: ['people', '혼잡도 예측'],
  propose_route: ['signpost', '코스 만들기'],
  search_jeju_places: ['geo-alt', '오름·박물관·기념품'],
  search_lodging: ['building', '숙박 정보'],
  get_hallasan_trails: ['tree', '한라산 둘레길'],
  get_traffic_accident_spots: ['exclamation-triangle', '사고 다발지역'],
  search_bus_stops: ['bus-front', '버스 정류소'],
}

const SUGGESTIONS = [
  '성산일출봉 근처에서 반나절 코스 만들어줘',
  '비 오는 날 서귀포에서 갈 만한 곳은?',
  '휠체어로 편하게 갈 수 있는 명소 추천해줘',
  '사람 적은 날 가기 좋은 오름 알려줘',
]

function RoutePanel({ route, summary }) {
  const saveRoute = useAppStore((s) => s.saveRoute)
  const user = useAppStore((s) => s.user)
  const [saved, setSaved] = useState(null) // 저장한 코스 제목

  if (!route) {
    return (
      <div className="jp-route">
        <div className="jp-route-empty">
          <i className="bi bi-signpost-split fs-1 text-jp" />
          <div className="fw-semibold text-body mt-2">추천 코스가 여기에 표시돼요</div>
          <p className="small mb-0 mt-1">“반나절 코스 만들어줘”처럼 요청하면 지도와 방문 순서로 정리해 드려요.</p>
        </div>
      </div>
    )
  }

  const isSaved = saved === route.title
  return (
    <div className="jp-route">
      <div className="jp-route-map"><KakaoMap route={route.stops} /></div>
      <div className="p-3">
        <div className="d-flex justify-content-between align-items-start gap-2">
          <div>
            <h2 className="h5 fw-bold mb-0">{route.title}</h2>
            <div className="small text-muted">{route.stops.length}곳 · 총 {route.total_km}km (직선거리 기준)</div>
          </div>
          <div className="d-flex gap-1 flex-shrink-0">
            <ShareButton getContent={() => ({
              title: route.title, description: route.stops.map((s) => s.name).join(' → '), url: routeShareUrl(route),
            })} />
            {isSaved
              ? <Link to="/my" className="btn btn-sm btn-outline-sea text-nowrap"><i className="bi bi-check2 me-1" />저장됨</Link>
              : <button className="btn btn-sm btn-primary text-nowrap" onClick={async () => { if (await saveRoute({ title: route.title, summary, stops: route.stops })) setSaved(route.title) }}>
                  <i className="bi bi-bookmark-plus me-1" />저장
                </button>}
          </div>
        </div>
        {!user && <div className="small text-muted mt-2"><Link to="/login">로그인</Link>하면 저장해서 다시 볼 수 있어요.</div>}

        <div className="mt-2">
          {route.stops.map((s, i) => (
            <div key={`${s.id}-${i}`} className="jp-stop">
              <span className="n">{i + 1}</span>
              <div className="min-w-0">
                <div className="fw-semibold">{s.name}</div>
                {s.note && <div className="small">{s.note}</div>}
                <div className="leg">{s.addr}{i > 0 && s.leg_km ? ` · 이전 장소에서 ${s.leg_km}km` : ''}</div>
              </div>
            </div>
          ))}
        </div>
        {route.not_found?.length > 0 && <div className="small text-muted mt-2">위치를 찾지 못한 곳: {route.not_found.join(', ')}</div>}
      </div>
    </div>
  )
}

export default function Agent() {
  const { messages, chatLoading, sendMessage, clearChat } = useAppStore()
  const [text, setText] = useState('')
  const [sp, setSp] = useSearchParams()
  const end = useRef(null)
  const started = useRef(false)

  // 다른 화면(홈·사진 카드)에서 ?q= 로 넘어온 질문은 자동으로 보낸다
  useEffect(() => {
    const q = sp.get('q')
    if (q && !started.current) {
      started.current = true
      sendMessage(q)
      setSp({}, { replace: true })
    }
  }, [sp, setSp, sendMessage])

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, chatLoading])

  const send = (t) => {
    const v = (t ?? text).trim()
    if (!v || chatLoading) return
    setText('')
    sendMessage(v)
  }

  const lastRouteMsg = [...messages].reverse().find((m) => m.role === 'assistant' && m.route)

  return (
    <>
    <PageBanner
      img="/images/jeju-night.jpg" pos="50% 75%" eyebrow="AI 가이드" title="무엇이든 물어보세요"
      sub="사진·날씨·혼잡도·접근성을 AI가 도구로 직접 확인하고, 코스까지 만들어 드려요."
    >
      {messages.length > 0 && <button className="btn btn-sm btn-outline-light" onClick={clearChat}><i className="bi bi-arrow-counterclockwise me-1" />새 대화</button>}
    </PageBanner>
    <Container className="pt-3">
      <div className="jp-agent">
        <div className="jp-chat">
          <div className="jp-chat-log">
            {messages.length === 0 && (
              <div className="jp-empty-chat">
                <i className="bi bi-stars fs-1 text-jp" />
                <p className="mt-2 mb-3 text-muted">이런 것들을 물어볼 수 있어요</p>
                <div className="d-grid gap-2">
                  {SUGGESTIONS.map((s) => <button key={s} className="jp-prompt" onClick={() => send(s)}>{s}</button>)}
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
                      const arg = [s.args?.place_name, s.args?.keyword, s.args?.title, s.args?.location].filter(Boolean)[0]
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
            {chatLoading && <div className="jp-bubble assistant text-muted"><span className="spinner-border spinner-border-sm me-2" />공공데이터를 확인하는 중…</div>}
            <div ref={end} />
          </div>

          <form className="jp-chat-form" onSubmit={(e) => { e.preventDefault(); send() }}>
            <input className="form-control" placeholder="제주 여행에 대해 물어보세요" value={text} onChange={(e) => setText(e.target.value)} disabled={chatLoading} aria-label="질문 입력" />
            <button className="btn btn-primary px-4" disabled={chatLoading || !text.trim()} aria-label="보내기"><i className="bi bi-arrow-up" /></button>
          </form>
        </div>

        <RoutePanel route={lastRouteMsg?.route} summary={lastRouteMsg?.text} />
      </div>
    </Container>
    </>
  )
}
