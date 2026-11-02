import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Container } from 'react-bootstrap'
import { useAppStore } from '../store/useAppStore'
import KakaoMap from '../components/KakaoMap'
import PageBanner from '../components/PageBanner'
import ShareButton from '../components/ShareButton'
import { routeShareUrl } from '../lib/share'
import { SPEECH_LANGS, defaultSpeechLang, saveSpeechLang, speechErrorMessage, useSpeech } from '../lib/useSpeech'

const TOOL_LABEL = {
  search_photos: ['images', '사진 검색'],
  get_photo_info: ['calendar3', '촬영지·시기'],
  find_nearby: ['signpost-split', '주변 명소'],
  get_weather: ['cloud-sun', '날씨'],
  check_accessibility: ['universal-access', '무장애 정보'],
  get_related_places: ['diagram-3', '연관 관광지'],
  get_crowd_forecast: ['people', '혼잡도 예측'],
  propose_route: ['signpost', '코스 만들기'],
  find_photo_spots: ['camera', '포토 스팟'],
  get_bus_arrivals: ['bus-front', '버스 도착'],
  get_flight_schedule: ['airplane', '공항 스케줄'],
  search_jeju_places: ['geo-alt', '오름·박물관·기념품'],
  search_lodging: ['building', '숙박 정보'],
  get_hallasan_trails: ['tree', '한라산 둘레길'],
}

const SUGGESTIONS = [
  '성산일출봉 근처에서 반나절 코스 만들어줘',
  '비 오는 날 서귀포에서 갈 만한 곳은?',
  '휠체어로 편하게 갈 수 있는 명소 추천해줘',
  '사람 적은 날 가기 좋은 오름 알려줘',
]

// 외국어로 물어봐도 같은 언어로 답한다 (영어·중국어·일본어)
const MULTI = [
  'Plan a half-day trip near Seongsan Ilchulbong and tell me how to get there by bus.',
  '请推荐济州岛适合拍日落照片的地方，并规划一条路线。',
  '雨の日に済州島で行ける場所を教えてください。',
]

const timeOf = (iso) => new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

// 도구 결과 미리보기 — 목록이면 한 건씩 한 줄로, 그 밖에는 "항목: 값"으로 보여 준다
const HIDE = new Set(['lat', 'lng', 'id', 'url', 'contentId', 'routeId', 'nodeId'])
const LABEL_KEYS = ['title', 'name', 'route', 'flight', 'ship', 'stopName', 'keyword', 'place']
const KEY_KO = {
  addr: '주소', km_from_base: '기준에서(km)', km: '거리(km)', dist: '거리(m)', leg_km: '이전에서(km)', total_km: '총(km)', note: '메모',
  minutes: '분 뒤', stops_away: '정거장 전', low_floor: '저상', temp: '기온', sky: '하늘', pop: '강수확률', rain: '강수', wind: '바람',
  sunrise: '일출', sunset: '일몰', dep: '출발', arr: '도착', from: '출발지', to: '도착지', fare_won: '요금(원)', date: '날짜',
  total_today: '오늘 전체', now_kst: '현재', airline: '항공사', category: '분류', themes: '테마', course: '코스', start: '시점', end: '종점',
  kind: '종류', near: '기준 장소', name: '이름', place: '장소', place_name: '장소', keyword: '검색어', location: '위치', port: '항구',
  direction: '방향', stop_name: '정류소', theme: '테마', radius_m: '반경(m)', lat: '위도', lng: '경도', title: '제목', count: '건수', stops: '장소',
}
const ko = (k) => KEY_KO[k] ?? k
const scalar = (v) => (v == null || typeof v === 'object' ? '' : String(v))

function ResultRow({ item }) {
  if (typeof item !== 'object' || item == null) return <div className="small">{scalar(item) || String(item)}</div>
  const entries = Object.entries(item).filter(([k, v]) => !HIDE.has(k) && scalar(v) !== '')
  const labelKey = LABEL_KEYS.find((k) => scalar(item[k]))
  const rest = entries.filter(([k]) => k !== labelKey)
  const nested = Object.entries(item).filter(([, v]) => v && typeof v === 'object')
  return (
    <div className="jp-step-row">
      {labelKey && <b>{scalar(item[labelKey])}</b>}
      {rest.length > 0 && <span className="text-muted"> {labelKey ? '· ' : ''}{rest.map(([k, v]) => `${ko(k)} ${scalar(v)}`).join(' · ')}</span>}
      {nested.map(([k, v]) => <div key={k} className="ps-3 small text-muted">{ko(k)}: {Array.isArray(v) ? v.map((x) => (typeof x === 'object' ? (x?.title ?? x?.name ?? x?.route ?? JSON.stringify(x)) : String(x))).join(', ') : JSON.stringify(v)}</div>)}
    </div>
  )
}

function StepDetail({ step }) {
  const args = Object.entries(step.args ?? {}).filter(([, v]) => v !== '' && v != null)
  const r = step.result
  return (
    <div className="jp-step-detail">
      {args.length > 0 && (
        <div className="mb-2">
          <div className="small fw-semibold">AI가 넣은 값</div>
          {args.map(([k, v]) => <div key={k} className="small text-muted">{ko(k)}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}</div>)}
        </div>
      )}
      <div className="small fw-semibold">받아온 결과{step.error ? ' (오류)' : ''}</div>
      {step.error && <div className="small text-danger">{step.error}</div>}
      {Array.isArray(r) && (r.length ? r.map((it, i) => <ResultRow key={i} item={it} />) : <div className="small text-muted">결과가 없어요</div>)}
      {r && !Array.isArray(r) && typeof r === 'object' && <ResultRow item={r} />}
      {r == null && !step.error && <div className="small text-muted">저장된 결과가 없어요</div>}
    </div>
  )
}

function RoutePanel({ route, summary, history = [], pick = 0, onPick }) {
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
      <div className="jp-route-map"><KakaoMap key={history[pick]?.id ?? route.title} route={route.stops} /></div>
      <div className="p-3">
        {history.length > 1 && (
          <select className="form-select form-select-sm mb-2" value={pick} onChange={(e) => onPick?.(Number(e.target.value))} aria-label="최근 추천 코스 고르기">
            {history.map((h, i) => <option key={h.id} value={i}>{i === 0 ? '최신 · ' : ''}{h.route.title} ({timeOf(h.at)})</option>)}
          </select>
        )}
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
  const { messages, chatLoading, sendMessage, clearChat, routeHistory } = useAppStore()
  const [text, setText] = useState('')
  const [openStep, setOpenStep] = useState(null) // 펼친 도구 칩: "메시지번호-도구번호"
  const [pick, setPick] = useState(0) // 코스 기록에서 보고 있는 항목 (0 = 최신)
  useEffect(() => { setPick(0) }, [routeHistory[0]?.id]) // 새 코스가 생기면 최신으로
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

  // 음성 질문: 말이 끝나면 바로 질문으로 보낸다
  const toast = useAppStore((s) => s.toast)
  const [lang, setLang] = useState(defaultSpeechLang)
  const speech = useSpeech({
    lang,
    onInterim: setText,
    onFinal: (t) => { setText(''); sendMessage(t) },
    onError: (code) => {
      setText('')
      const m = speechErrorMessage(code)
      if (m) toast(m[0], m[1])
    },
  })
  const pickLang = (code) => {
    setLang(code)
    saveSpeechLang(code)
  }
  const hint = SPEECH_LANGS.find((l) => l.code === lang)?.hint

  const shown = routeHistory[pick] ?? routeHistory[0] // 화면에 보여 줄 코스: 기본은 가장 최근

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
                <p className="mt-4 mb-2 small text-muted"><i className="bi bi-translate me-1" />English · 中文 · 日本語로 물어봐도 같은 언어로 답해요</p>
                <div className="d-grid gap-2">
                  {MULTI.map((s) => <button key={s} className="jp-prompt" lang={/[぀-ヿ]/.test(s) ? 'ja' : /[一-鿿]/.test(s) ? 'zh' : 'en'} onClick={() => send(s)}>{s}</button>)}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`jp-bubble ${m.role}`}>
                {m.text}
                {m.steps?.length > 0 && (
                  <div className="mt-2 pt-2 border-top">
                    <div className="small text-muted mb-1">AI가 호출한 도구 <span className="opacity-75">· 눌러서 결과 보기</span></div>
                    {m.steps.map((s, j) => {
                      const [icon, label] = TOOL_LABEL[s.tool] ?? ['tools', s.tool]
                      const arg = [s.args?.place_name, s.args?.keyword, s.args?.title, s.args?.location].filter(Boolean)[0]
                      const key = `${i}-${j}`
                      const on = openStep === key
                      return (
                        <button type="button" key={j} className={`jp-step ${s.error ? 'err' : ''} ${on ? 'on' : ''}`} aria-expanded={on}
                          onClick={() => setOpenStep(on ? null : key)} title={s.error || '눌러서 AI가 받아온 결과 보기'}>
                          <i className={`bi bi-${icon}`} />{label}{arg && ` · ${arg}`}{s.count != null && ` (${s.count}건)`}{s.error && ' ⚠'}
                          <i className={`bi bi-chevron-${on ? 'up' : 'down'} ms-1`} />
                        </button>
                      )
                    })}
                    {m.steps.map((s, j) => openStep === `${i}-${j}` && <StepDetail key={`d${j}`} step={s} />)}
                  </div>
                )}
              </div>
            ))}
            {chatLoading && <div className="jp-bubble assistant text-muted"><span className="spinner-border spinner-border-sm me-2" />공공데이터를 확인하는 중…</div>}
            <div ref={end} />
          </div>

          <form className="jp-chat-form" onSubmit={(e) => { e.preventDefault(); if (speech.listening) speech.stop(); send() }}>
            {speech.supported && (
              <select className="form-select jp-lang" value={lang} onChange={(e) => pickLang(e.target.value)} disabled={speech.listening} aria-label="음성 인식 언어" title="음성 인식 언어">
                {SPEECH_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            )}
            <input className="form-control" placeholder={speech.listening ? hint : '제주 여행에 대해 물어보세요 (English · 中文 · 日本語 OK)'} value={text} onChange={(e) => setText(e.target.value)} disabled={chatLoading} aria-label="질문 입력" />
            {speech.supported && (
              <button type="button" className={`btn btn-outline-sea jp-mic ${speech.listening ? 'on' : ''}`} onClick={speech.listening ? speech.stop : speech.start} disabled={chatLoading}
                aria-label={speech.listening ? '음성 입력 멈추기' : '음성으로 질문하기'} title={speech.listening ? '멈추기' : '말로 질문하기'}>
                <i className={`bi bi-mic${speech.listening ? '-fill' : ''}`} />
              </button>
            )}
            <button className="btn btn-primary px-4" disabled={chatLoading || !text.trim()} aria-label="보내기"><i className="bi bi-arrow-up" /></button>
          </form>
        </div>

        <RoutePanel route={shown?.route} summary={shown?.summary} history={routeHistory} pick={pick} onPick={setPick} />
      </div>
    </Container>
    </>
  )
}
