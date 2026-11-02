import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Col, Container, Row } from 'react-bootstrap'
import { fetchPhotos } from '../api/client'
import { useAsync } from '../lib/useAsync'
import PhotoCard from '../components/PhotoCard'
import WeatherBadge from '../components/WeatherBadge'
import Status from '../components/Status'

const THEMES = ['오름', '바다', '폭포', '해변', '유채꽃', '일출', '한라산', '올레길', '야경']

const FEATURES = [
  { icon: 'images', title: '사진으로 먼저 만나요', text: '가고 싶은 곳을 사진으로 둘러보고 마음에 드는 곳을 담아 두세요.' },
  { icon: 'calendar-heart', title: '언제 찍은 곳인지', text: '촬영지와 촬영 시기로 가기 좋은 계절을 알려 드려요.' },
  { icon: 'signpost-split', title: '근처에 뭐가 있지?', text: '그 주변 명소·맛집과 함께 가는 곳까지 한 번에.' },
  { icon: 'cloud-sun', title: '날씨와 무장애 정보', text: '오늘 날씨, 비 오면 실내 대안, 휠체어·유모차 접근성까지.' },
]

export default function Home() {
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const photos = useAsync(() => fetchPhotos('', 8), [])

  const go = (e) => { e.preventDefault(); nav(`/explore?q=${encodeURIComponent(q.trim())}`) }

  return (
    <>
      <section className="jp-hero">
        <Container>
          <Row className="align-items-center g-4">
            <Col lg={8}>
              <span className="badge rounded-pill text-bg-light mb-3"><i className="bi bi-camera me-1" />관광객을 위한 사진 명소 갤러리</span>
              <h1>사진으로 먼저 만나는<br />제주 여행 🍊</h1>
              <p className="lead mt-3 mb-4">
                여행 전에 사진으로 둘러보고, 촬영지·계절·주변 명소·날씨·접근성까지 한 번에 확인하세요.
              </p>
              <form className="jp-search" onSubmit={go}>
                <input className="form-control" placeholder="어떤 제주가 보고 싶으세요? (예: 성산일출봉, 오름)" value={q} onChange={(e) => setQ(e.target.value)} />
                <button className="btn btn-primary px-4" type="submit"><i className="bi bi-search me-1" />검색</button>
              </form>
              <div className="jp-themes">
                {THEMES.map((t) => <Link key={t} className="jp-theme" to={`/explore?q=${encodeURIComponent(t)}`}>#{t}</Link>)}
              </div>
            </Col>
            <Col lg={4}>
              <div className="d-flex flex-lg-column gap-2 flex-wrap">
                <WeatherBadge place="제주시" />
                <WeatherBadge place="서귀포시" />
                <Link to="/map" className="btn btn-light rounded-pill fw-semibold mt-lg-2"><i className="bi bi-globe-asia-australia me-1" />3D 제주 지도 열기</Link>
              </div>
            </Col>
          </Row>
        </Container>
        <svg className="jp-wave" viewBox="0 0 1440 70" preserveAspectRatio="none" aria-hidden="true">
          <path fill="#fffaf2" d="M0 40c120 25 240 25 360 5s240-35 360-25 240 40 360 40 240-25 360-15v25H0z" />
        </svg>
      </section>

      <Container className="py-4">
        <div className="d-flex justify-content-between align-items-end mb-3">
          <h2 className="h4 jp-section-title mb-0">지금 만나는 제주 풍경</h2>
          <Link to="/explore" className="text-decoration-none">더 보기 <i className="bi bi-arrow-right" /></Link>
        </div>
        <Status loading={photos.loading} error={photos.error} empty={!photos.loading && !photos.error && !photos.data?.length} />
        <Row xs={1} sm={2} lg={4} className="g-3">
          {photos.data?.map((p) => <Col key={p.id || p.image}><PhotoCard photo={p} /></Col>)}
        </Row>
      </Container>

      <Container className="py-4">
        <h2 className="h4 jp-section-title mb-3">제주픽으로 이렇게 여행해요</h2>
        <Row xs={1} sm={2} lg={4} className="g-3">
          {FEATURES.map((f) => (
            <Col key={f.title}>
              <div className="jp-feature">
                <i className={`bi bi-${f.icon}`} />
                <h3 className="h6 fw-bold mt-2">{f.title}</h3>
                <p className="small text-muted mb-0">{f.text}</p>
              </div>
            </Col>
          ))}
        </Row>
      </Container>
    </>
  )
}
