import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Col, Container, Row } from 'react-bootstrap'
import { fetchPhotos } from '../api/client'
import { useAppStore } from '../store/useAppStore'
import { SPEECH_LANGS, defaultSpeechLang, saveSpeechLang, speechErrorMessage, useSpeech } from '../lib/useSpeech'
import { useAsync } from '../lib/useAsync'
import { shuffleDiverse } from '../lib/format'
import PhotoCard from '../components/PhotoCard'
import WeatherBadge from '../components/WeatherBadge'
import Status from '../components/Status'

const PROMPTS = [
  '성산일출봉 근처에서 반나절 코스 만들어줘',
  '비 오는 날 서귀포에서 갈 만한 곳은?',
  '휠체어로 편하게 갈 수 있는 명소 추천해줘',
  '사람 적은 날 가기 좋은 오름 알려줘',
  '유채꽃을 볼 수 있는 곳과 근처 코스를 알려줘',
]

// 히어로 배경 (public/images, Pixabay 무료 이미지)
const HERO = [
  { src: '/images/jeju-beach.jpg', pos: '50% 60%' },
  { src: '/images/jeju-muhly.jpg', pos: '50% 65%' },
  { src: '/images/jeju-lighthouse.jpg', pos: '50% 55%' },
  { src: '/images/jeju-night.jpg', pos: '50% 70%' },
  { src: '/images/jeju-canola.jpg', pos: '50% 70%' },
]

// "오늘은 어디로?" — 카드를 누르면 해당 주제로 AI 가이드에게 바로 질문
const THEMES = [
  { img: '/images/jeju-canola.jpg', tag: '꽃 · 해안', title: '유채꽃과 검은 현무암 해안', prompt: '유채꽃을 볼 수 있는 곳을 알려주고 근처 코스도 만들어줘' },
  { img: '/images/jeju-muhly.jpg', tag: '오름 · 들판', title: '핑크뮬리가 번지는 오름 들판', prompt: '핑크뮬리와 오름 풍경을 볼 수 있는 곳을 알려주고 코스를 만들어줘' },
  { img: '/images/jeju-chairs.jpg', tag: '해변 · 휴식', title: '하얀 모래 위의 느린 하루', prompt: '아이와 함께 쉬어 가기 좋은 해변을 추천해줘. 근처 갈 곳도 알려줘' },
  { img: '/images/jeju-lighthouse.jpg', tag: '항구 · 산책', title: '붉은 등대와 바다 산책', prompt: '등대와 바다 풍경을 볼 수 있는 해안 반나절 코스를 만들어줘. 일몰 시각도 알려줘' },
  { img: '/images/jeju-night.jpg', tag: '밤하늘 · 별', title: '별이 쏟아지는 제주의 밤', prompt: '별을 보기 좋은 한적한 곳을 알려줘. 날씨와 혼잡도도 확인해줘' },
  { img: '/images/jeju-haenyeo.jpg', tag: '해녀 · 돌문화', title: '해녀와 돌담, 제주의 삶', prompt: '해녀 문화와 돌문화를 느낄 수 있는 곳을 코스로 만들어줘' },
]

// AI 가이드가 실제로 호출하는 도구 = 공공데이터 API — 카드를 누르면 그 도구를 쓰는 질문으로 이동
const TOOLS = [
  { icon: 'camera', name: '포토 스팟 추천', src: '한국관광공사 관광지 · 테마별 사진 명소', prompt: '일몰 사진 찍기 좋은 곳을 추천하고, 가까운 순서로 코스를 만들어줘' },
  { icon: 'images', name: '사진 검색·촬영지', src: '한국관광공사 관광사진 · 공모전 수상작', prompt: '오름 사진을 보여주고 어디에서 찍은 건지 알려줘' },
  { icon: 'signpost-split', name: '주변 명소·연관 관광지', src: '한국관광공사 국문 관광정보 · 연관 관광지', prompt: '성산일출봉 주변 명소와 함께 가기 좋은 곳을 알려줘' },
  { icon: 'cloud-sun', name: '날씨·일출·일몰', src: '기상청 단기예보 · 한국천문연구원', prompt: '지금 제주 날씨와 오늘 일몰 시각을 알려줘' },
  { icon: 'people', name: '혼잡도 예측', src: '한국관광공사 관광지 집중률', prompt: '성산일출봉은 앞으로 언제가 가장 한적해?' },
  { icon: 'tree', name: '한라산 둘레길·오름·박물관', src: '제주데이터허브', prompt: '한라산 둘레길 코스를 거리와 함께 알려줘' },
  { icon: 'signpost', name: '코스·경로 만들기', src: '장소 좌표와 구간 거리 계산', prompt: '서귀포에서 반나절 코스를 만들어줘' },
]

export default function Home() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const [hero, setHero] = useState(() => Math.floor(Math.random() * HERO.length)) // 접속할 때마다 다른 사진으로 시작
  const photos = useAsync(() => fetchPhotos('', 40), [])
  const gallery = useMemo(() => shuffleDiverse(photos.data ?? [], 1).slice(0, 8), [photos.data])

  // 히어로 배경을 천천히 전환 (모션 줄이기 설정이면 고정)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setHero((i) => (i + 1) % HERO.length), 7000)
    return () => clearInterval(t)
  }, [])

  const ask = (text) => nav(`/agent?q=${encodeURIComponent(text)}`)
  const submit = (e) => { e.preventDefault(); if (speech.listening) speech.stop(); if (q.trim()) ask(q.trim()) }

  // 음성 질문: 말이 끝나면 AI 가이드 페이지로 넘어가 바로 답을 받는다
  const toast = useAppStore((s) => s.toast)
  const [lang, setLang] = useState(defaultSpeechLang)
  const speech = useSpeech({
    lang,
    onInterim: setQ,
    onFinal: (t) => { setQ(''); ask(t) },
    onError: (code) => {
      setQ('')
      const m = speechErrorMessage(code)
      if (m) toast(m[0], m[1])
    },
  })
  const pickLang = (code) => { setLang(code); saveSpeechLang(code) }
  const cur = SPEECH_LANGS.find((l) => l.code === lang)

  return (
    <>
      <section className="jp-hero">
        <div className="jp-hero-bg" aria-hidden="true">
          {HERO.map((h, i) => (
            <div key={h.src} className={i === hero ? 'on' : ''} style={{ backgroundImage: `url(${h.src})`, backgroundPosition: h.pos }} />
          ))}
        </div>
        <Container className="jp-hero-inner">
          <div className="jp-eyebrow mb-3">AI 제주 여행 가이드</div>
          <h1>인생샷 한 장에서 시작해<br />제주 하루 코스가 됩니다.</h1>
          <p className="lead mt-3 mb-4">
            사진·날씨·혼잡도·주변 명소·접근성을 AI가 공공데이터로 직접 확인하고, 방문 순서까지 정리해 드려요.
          </p>

          <form className="jp-ask-box" onSubmit={submit}>
            <input className="form-control" placeholder={speech.listening ? cur?.hint : '예) 가족과 2박 3일, 비 와도 괜찮은 코스'} value={q}
              onChange={(e) => setQ(e.target.value)} aria-label="AI 가이드에게 질문" />
            {speech.supported && (
              <>
                <select className="form-select jp-lang" value={lang} onChange={(e) => pickLang(e.target.value)} disabled={speech.listening} aria-label="음성 인식 언어" title="음성 인식 언어">
                  {SPEECH_LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
                </select>
                <button type="button" className={`btn btn-outline-sea jp-mic ${speech.listening ? 'on' : ''}`} onClick={speech.listening ? speech.stop : speech.start}
                  aria-label={speech.listening ? '음성 입력 멈추기' : '음성으로 질문하기'} title={speech.listening ? '멈추기' : '말로 질문하기'}>
                  <i className={`bi bi-mic${speech.listening ? '-fill' : ''}`} />
                </button>
              </>
            )}
            <button className="btn btn-primary" type="submit"><i className="bi bi-stars me-1" />물어보기</button>
          </form>
          {speech.supported && (
            <div className="jp-ask-note"><i className="bi bi-mic me-1" />{speech.listening ? `듣고 있어요 · ${cur?.label}` : `마이크 버튼을 누르고 ${cur?.label}(으)로 말해 보세요 · 한국어 · English · 中文 · 日本語`}</div>
          )}

          <div className="jp-prompts">
            {PROMPTS.map((p) => <button key={p} type="button" className="jp-prompt" onClick={() => ask(p)}>{p}</button>)}
          </div>

          <div className="jp-hero-weather">
            <WeatherBadge place="제주시" />
            <WeatherBadge place="서귀포시" />
          </div>
        </Container>
      </section>

      <Container className="py-5">
        <div className="jp-eyebrow mb-1">Themes</div>
        <h2 className="h4 jp-section-title mb-1">오늘은 어디로 떠나볼까요</h2>
        <p className="text-muted mb-4">마음에 드는 풍경을 고르면 AI가 그 주제로 코스를 만들어 드려요.</p>
        <Row xs={1} sm={2} lg={3} className="g-3 jp-hscroll">
          {THEMES.map((t) => (
            <Col key={t.title}>
              <Link to={`/agent?q=${encodeURIComponent(t.prompt)}`} className="jp-theme-card">
                <img src={t.img} alt={t.title} loading="lazy" />
                <div className="body">
                  <span className="tag">{t.tag}</span>
                  <div className="title">{t.title}</div>
                  <span className="go">AI에게 코스 묻기 <i className="bi bi-arrow-right" /></span>
                </div>
              </Link>
            </Col>
          ))}
        </Row>
      </Container>

      <Container className="pb-5">
        <div className="jp-eyebrow mb-1">How it works</div>
        <h2 className="h4 jp-section-title mb-1">AI가 직접 확인하고 답해요</h2>
        <p className="text-muted mb-4">카드를 누르면 그 데이터를 쓰는 질문을 AI에게 바로 던져 볼 수 있어요. 답변마다 호출한 도구도 화면에 보여 드려요.</p>
        <Row xs={1} sm={2} lg={3} className="g-3 jp-hscroll jp-hscroll-sm">
          {TOOLS.map((t) => (
            <Col key={t.name}>
              <Link to={`/agent?q=${encodeURIComponent(t.prompt)}`} className="jp-tool">
                <i className={`bi bi-${t.icon}`} />
                <div className="fw-semibold mt-2">{t.name}</div>
                <div className="src">{t.src}</div>
                <div className="try">“{t.prompt}” <i className="bi bi-arrow-right" /></div>
              </Link>
            </Col>
          ))}
        </Row>
      </Container>

      <Container className="pb-4">
        <div className="d-flex justify-content-between align-items-end mb-3">
          <div>
            <div className="jp-eyebrow mb-1">Gallery</div>
            <h2 className="h4 jp-section-title mb-0">오늘의 제주 풍경</h2>
          </div>
          <Link to="/explore" className="text-decoration-none small">사진 더 보기 <i className="bi bi-arrow-right" /></Link>
        </div>
        <Status loading={photos.loading} error={photos.error} empty={!photos.loading && !photos.error && !gallery.length} />
        <Row xs={2} sm={2} lg={4} className="g-2 g-md-3">
          {gallery.map((p) => <Col key={p.id || p.image}><PhotoCard photo={p} /></Col>)}
        </Row>
      </Container>
    </>
  )
}
