import { Link, useSearchParams } from 'react-router-dom'
import { Col, Container, Row } from 'react-bootstrap'
import { decodeRoute, routeShareUrl } from '../lib/share'
import KakaoMap from '../components/KakaoMap'
import PageBanner from '../components/PageBanner'
import ShareButton from '../components/ShareButton'

// 링크로 공유된 코스 보기 — 로그인 없이 누구나 열 수 있다 (코스 정보는 주소에 들어 있음)
export default function SharedRoute() {
  const [sp] = useSearchParams()
  const route = decodeRoute(sp.get('d') ?? '')

  if (!route) {
    return (
      <Container className="text-center py-5">
        <i className="bi bi-link-45deg fs-1 text-jp" />
        <h1 className="h4 fw-bold mt-2">열 수 없는 공유 링크예요</h1>
        <p className="text-muted">링크가 잘리거나 바뀌었을 수 있어요. 보낸 사람에게 다시 요청해 보세요.</p>
        <Link to="/agent" className="btn btn-primary px-4">내 코스 만들어 보기</Link>
      </Container>
    )
  }

  return (
    <>
      <PageBanner img="/images/jeju-lighthouse.jpg" pos="50% 58%" eyebrow="공유된 코스" title={route.title} sub={`${route.stops.length}곳을 순서대로 도는 코스예요.`}>
        <ShareButton className="btn btn-sm btn-light" getContent={() => ({
          title: route.title, description: route.stops.map((s) => s.name).join(' → '), url: routeShareUrl(route),
        })} />
      </PageBanner>
      <Container className="pt-4">
        <Row className="g-3">
          <Col lg={7}>
            <div className="jp-route-map rounded-3 overflow-hidden" style={{ height: 420 }}><KakaoMap route={route.stops} profile="driving" /></div>
          </Col>
          <Col lg={5}>
            <div className="jp-panel">
              {route.stops.map((s, i) => (
                <div key={`${s.name}-${i}`} className="jp-stop">
                  <span className="n">{i + 1}</span>
                  <div className="min-w-0">
                    <div className="fw-semibold">{s.name}</div>
                    {s.note && <div className="small">{s.note}</div>}
                    <Link className="leg text-decoration-none" to={`/explore?q=${encodeURIComponent(s.name)}`}>사진 보기 <i className="bi bi-arrow-right" /></Link>
                  </div>
                </div>
              ))}
            </div>
            <div className="d-grid gap-2 mt-3">
              <Link className="btn btn-primary" to={`/agent?q=${encodeURIComponent(`${route.title} 코스를 날씨와 혼잡도까지 확인해서 더 알차게 다듬어줘`)}`}>
                <i className="bi bi-stars me-1" />AI에게 이 코스 다듬어 달라고 하기
              </Link>
              <Link className="btn btn-outline-sea" to="/agent">나만의 코스 만들기</Link>
            </div>
          </Col>
        </Row>
      </Container>
    </>
  )
}
