import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Col, Container, Row } from 'react-bootstrap'
import { fetchPhotos } from '../api/client'
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
  '유채꽃 사진 찍힌 곳은 언제 가면 좋아?',
]

// 히어로 배경 (public/images, Pixabay 무료 이미지)
const HERO = [
  { src: '/images/jeju-beach.jpg', pos: '50% 60%' },
  { src: '/images/jeju-lighthouse.jpg', pos: '50% 55%' },
  { src: '/images/jeju-canola.jpg', pos: '50% 70%' },
]

// "오늘은 어디로?" — 카드를 누르면 해당 주제로 AI 가이드에게 바로 질문
const THEMES = [
  {
    img: '/images/jeju-canola.jpg', tag: '봄 · 꽃', title: '유채꽃과 검은 현무암 해안',
    prompt: '유채꽃 사진 찍힌 곳은 어디고, 언제 가야 해? 근처 코스도 알려줘',
  },
  {
    img: '/images/jeju-beach.jpg', tag: '해변 · 바다', title: '에메랄드빛 해변 하루',
    prompt: '아이와 함께 갈 만한 해변을 추천해줘. 해수욕장 수질도 같이 확인해줘',
  },
  {
    img: '/images/jeju-lighthouse.jpg', tag: '항구 · 드라이브', title: '붉은 등대와 바다 산책',
    prompt: '등대와 바다 풍경을 볼 수 있는 해안 반나절 코스를 만들어줘. 일몰 시각도 알려줘',
  },
]

// AI 가이드가 실제로 호출하는 도구 = 공공데이터 API
const TOOLS = [
  { icon: 'images', name: '사진 검색·촬영지', src: '한국관광공사 관광사진 · 공모전 수상작' },
  { icon: 'signpost-split', name: '주변 명소·연관 관광지', src: '한국관광공사 국문 관광정보 · 연관 관광지' },
  { icon: 'cloud-sun', name: '날씨·일출·일몰', src: '기상청 단기예보 · 한국천문연구원' },
  { icon: 'people', name: '혼잡도 예측', src: '한국관광공사 관광지 집중률' },
  { icon: 'water', name: '해수욕장 수질·둘레길', src: '제주데이터허브' },
  { icon: 'signpost', name: '코스·경로 만들기', src: '장소 좌표와 구간 거리 계산' },
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
  const submit = (e) => { e.preventDefault(); if (q.trim()) ask(q.trim()) }

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
          <h1>제주 여행,<br />물어보면 코스가 됩니다.</h1>
          <p className="lead mt-3 mb-4">
            사진·날씨·혼잡도·주변 명소·접근성을 AI가 공공데이터로 직접 확인하고, 방문 순서까지 정리해 드려요.
          </p>

          <form className="jp-ask-box" onSubmit={submit}>
            <input className="form-control" placeholder="예) 가족과 2박 3일, 비 와도 괜찮은 코스" value={q}
              onChange={(e) => setQ(e.target.value)} aria-label="AI 가이드에게 질문" />
            <button className="btn btn-primary" type="submit"><i className="bi bi-stars me-1" />물어보기</button>
          </form>

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
        <Row xs={1} md={3} className="g-3">
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
        <p className="text-muted mb-4">답변마다 AI가 어떤 데이터를 호출했는지 화면에 그대로 보여 드려요.</p>
        <Row xs={1} sm={2} lg={3} className="g-3">
          {TOOLS.map((t) => (
            <Col key={t.name}>
              <div className="jp-tool">
                <i className={`bi bi-${t.icon}`} />
                <div className="fw-semibold mt-2">{t.name}</div>
                <div className="src">{t.src}</div>
              </div>
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
        <Row xs={1} sm={2} lg={4} className="g-3">
          {gallery.map((p) => <Col key={p.id || p.image}><PhotoCard photo={p} /></Col>)}
        </Row>
      </Container>
    </>
  )
}
