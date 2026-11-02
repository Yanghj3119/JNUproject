import { useEffect } from 'react'
import { NavLink, Link, Outlet, ScrollRestoration } from 'react-router-dom'
import { Container, Nav, Navbar, Toast, ToastContainer } from 'react-bootstrap'
import { NAV_ITEMS } from '../router'
import { useAppStore } from '../store/useAppStore'
import { displayName } from '../lib/format'

// 로고: 오름의 부드러운 곡선 + 제주 바다의 물결 + 감귤빛 점 (심플한 도형만 사용)
const Mark = () => (
  <svg className="jp-mark" viewBox="0 0 64 64" aria-hidden="true">
    <rect width="64" height="64" rx="16" fill="#0f1a20" />
    <path d="M9 41C16 24 25 19 32 19s16 5 23 22z" fill="#2563eb" />
    <path d="M9 41C16 24 25 19 32 19" fill="none" stroke="#93c5fd" strokeWidth="2" strokeLinecap="round" opacity=".7" />
    <path d="M9 49q5.75-5 11.5 0t11.5 0 11.5 0 11.5 0" fill="none" stroke="#7dd3fc" strokeWidth="3" strokeLinecap="round" />
    <circle cx="47" cy="15" r="4.5" fill="#f59e0b" />
  </svg>
)

export default function RootLayout() {
  const toasts = useAppStore((s) => s.toasts)
  const user = useAppStore((s) => s.user)
  const authReady = useAppStore((s) => s.authReady)
  const initAuth = useAppStore((s) => s.initAuth)
  const signOut = useAppStore((s) => s.signOut)

  useEffect(() => { initAuth() }, [initAuth])

  const name = displayName(user)

  return (
    <div className="jp-shell">
      <Navbar expand="md" sticky="top" className="jp-nav">
        <Container>
          <Navbar.Brand as={Link} to="/" className="jp-brand" aria-label="제주픽 홈으로" title="홈으로"><Mark /><span>제주픽</span></Navbar.Brand>
          <Navbar.Toggle aria-controls="jp-menu" />
          <Navbar.Collapse id="jp-menu">
            <Nav className="ms-auto align-items-md-center gap-md-1">
              {NAV_ITEMS.map((n) => (
                <Nav.Link key={n.to} as={NavLink} to={n.to} end={n.to === '/'} className={`jp-link ${n.ai ? 'ai' : ''}`}>
                  <i className={`bi bi-${n.icon} me-1`} />{n.label}
                </Nav.Link>
              ))}
              {authReady && (user ? (
                <div className="d-flex align-items-center gap-2 ms-md-3 mt-2 mt-md-0">
                  <NavLink to="/my" className={({ isActive }) => `jp-account ${isActive ? 'on' : ''}`} title="내 보관함 (위시리스트·저장한 경로)">
                    <i className="bi bi-person-circle me-1" />{name}
                  </NavLink>
                  <button className="btn btn-sm btn-outline-sea" onClick={signOut}>로그아웃</button>
                </div>
              ) : (
                <Nav.Link as={NavLink} to="/login" className="jp-link ms-md-2">로그인</Nav.Link>
              ))}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <main className="jp-main"><Outlet /></main>

      <footer className="jp-footer">
        <Container className="d-flex flex-wrap justify-content-between gap-2">
          <span>제주픽 · 한국관광공사 · 기상청 · 한국천문연구원 공공데이터 기반 AI 제주 여행 가이드</span>
          <Link to="/status" className="text-decoration-none"><i className="bi bi-activity me-1" />연결 상태</Link>
        </Container>
        <Container className="mt-1 small opacity-75">
          관광사진은 공공누리 유형에 따라 이용 조건이 있어요. 상업적 재사용 전에 출처 표기를 확인하세요. · 홈 배경 이미지: <a href="https://pixabay.com" target="_blank" rel="noreferrer">Pixabay</a>
        </Container>
      </footer>

      <ToastContainer position="bottom-center" className="p-3" style={{ zIndex: 2000 }}>
        {toasts.map((t) => (
          <Toast key={t.id} bg={t.variant === 'success' ? 'dark' : t.variant} show autohide={false}>
            <Toast.Body className={t.variant === 'warning' || t.variant === 'secondary' ? '' : 'text-white'}>{t.message}</Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
      <ScrollRestoration />
    </div>
  )
}
