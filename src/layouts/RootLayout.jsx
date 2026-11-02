import { useEffect } from 'react'
import { NavLink, Link, Outlet, ScrollRestoration } from 'react-router-dom'
import { Container, Nav, Navbar, Toast, ToastContainer } from 'react-bootstrap'
import { NAV_ITEMS } from '../router'
import { useAppStore } from '../store/useAppStore'

export default function RootLayout() {
  const toasts = useAppStore((s) => s.toasts)
  const nickname = useAppStore((s) => s.nickname)
  const loadFavorites = useAppStore((s) => s.loadFavorites)

  // 닉네임이 바뀔 때마다 그 사람의 보관함을 불러옴 (하트 표시용)
  useEffect(() => { loadFavorites() }, [nickname, loadFavorites])

  return (
    <div className="jp-shell">
      <Navbar expand="md" sticky="top" className="jp-nav">
        <Container>
          <Navbar.Brand as={Link} to="/" className="jp-brand">
            <span className="jp-logo">🍊</span> 제주픽
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="jp-menu" />
          <Navbar.Collapse id="jp-menu">
            <Nav className="ms-auto gap-md-1">
              {NAV_ITEMS.map((n) => (
                <Nav.Link key={n.to} as={NavLink} to={n.to} end={n.to === '/'} className="jp-link">
                  <i className={`bi bi-${n.icon} me-1`} />{n.label}
                </Nav.Link>
              ))}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <main className="jp-main"><Outlet /></main>

      <footer className="jp-footer">
        <Container className="d-flex flex-wrap justify-content-between gap-2">
          <span>제주픽 · 한국관광공사 · 기상청 공공데이터로 만든 제주 여행 가이드</span>
          <Link to="/status" className="text-decoration-none"><i className="bi bi-activity me-1" />연결 상태</Link>
        </Container>
        <Container className="mt-1 small opacity-75">
          관광사진은 공공누리 유형에 따라 이용 조건이 있어요. 상업적 재사용 전에 출처 표기를 확인하세요.
        </Container>
      </footer>

      <ToastContainer position="bottom-center" className="p-3" style={{ zIndex: 2000 }}>
        {toasts.map((t) => (
          <Toast key={t.id} bg={t.variant} show autohide={false}>
            <Toast.Body className={t.variant === 'warning' || t.variant === 'secondary' ? '' : 'text-white'}>{t.message}</Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
      <ScrollRestoration />
    </div>
  )
}
