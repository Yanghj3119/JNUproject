import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Col, Container, Row } from 'react-bootstrap'
import { useAppStore } from '../store/useAppStore'
import { isSupabaseReady } from '../lib/supabase'
import KakaoMap from '../components/KakaoMap'
import PageBanner from '../components/PageBanner'
import Status from '../components/Status'

const dateOf = (iso) => new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

function RouteCard({ route }) {
  const del = useAppStore((s) => s.deleteRoute)
  const [open, setOpen] = useState(false)
  const stops = route.stops ?? []
  const km = Math.round(stops.reduce((a, s) => a + (s.leg_km || 0), 0) * 10) / 10

  return (
    <div className="jp-panel">
      <div className="d-flex justify-content-between align-items-start gap-2">
        <div>
          <div className="fw-bold">{route.title}</div>
          <div className="small text-muted">{dateOf(route.created_at)} · {stops.length}곳 · 총 {km}km</div>
        </div>
        <div className="d-flex gap-1">
          <button className="btn btn-sm btn-outline-sea" onClick={() => setOpen(!open)}>{open ? '접기' : '지도로 보기'}</button>
          <button className="btn btn-sm btn-outline-sea" aria-label="경로 삭제" onClick={() => window.confirm('이 경로를 삭제할까요?') && del(route.id)}><i className="bi bi-trash" /></button>
        </div>
      </div>
      <div className="small mt-2 text-muted">{stops.map((s) => s.name).join(' → ')}</div>
      {open && (
        <div className="mt-3">
          <div className="jp-route-map rounded-3 overflow-hidden"><KakaoMap route={stops} /></div>
          {stops.map((s, i) => (
            <div key={`${s.id}-${i}`} className="jp-stop">
              <span className="n">{i + 1}</span>
              <div className="min-w-0">
                <div className="fw-semibold">{s.name}</div>
                {s.note && <div className="small">{s.note}</div>}
                <div className="leg">{s.addr}</div>
              </div>
            </div>
          ))}
          {route.summary && <p className="small text-muted mt-2 mb-0" style={{ whiteSpace: 'pre-wrap' }}>{route.summary}</p>}
        </div>
      )}
    </div>
  )
}

export default function My() {
  const user = useAppStore((s) => s.user)
  const authReady = useAppStore((s) => s.authReady)
  const favorites = useAppStore((s) => s.favorites)
  const favLoading = useAppStore((s) => s.favLoading)
  const routes = useAppStore((s) => s.routes)
  const toggle = useAppStore((s) => s.toggleFavorite)
  const [tab, setTab] = useState('wish') // 'wish' | 'routes'

  const linkOf = (f) => (f.source === 'photo'
    ? `/photo/${encodeURIComponent(f.item_id)}?${new URLSearchParams({ title: f.title, img: f.image ?? '' })}`
    : `/explore?q=${encodeURIComponent(f.title)}`)

  if (!isSupabaseReady) {
    return <Container><div className="alert alert-warning mt-4">Supabase 설정(<code>.env.local</code>)이 없어서 보관함을 쓸 수 없어요.</div></Container>
  }
  if (authReady && !user) {
    return (
      <PageBanner img="/images/jeju-chairs.jpg" pos="50% 55%" eyebrow="내 보관함" title="로그인하고 내 여행을 모아 보세요"
        sub="담아 둔 위시리스트와 AI가 만든 코스를 언제든 다시 볼 수 있어요.">
        <Link to="/login" className="btn btn-light px-4">로그인 · 회원가입</Link>
      </PageBanner>
    )
  }

  const name = user?.user_metadata?.name || user?.email?.split('@')[0]

  return (
    <>
    <PageBanner img="/images/jeju-chairs.jpg" pos="50% 55%" eyebrow="내 보관함" title={`${name}님의 여행`}
      sub={`위시리스트 ${favorites.length}개 · 저장한 경로 ${routes.length}개`}>
      <Link to="/agent" className="btn btn-light"><i className="bi bi-stars me-1" />AI에게 코스 물어보기</Link>
    </PageBanner>
    <Container className="pt-4">
      <div className="jp-tabs" style={{ maxWidth: 360 }}>
        <button type="button" className={`jp-tab ${tab === 'wish' ? 'on' : ''}`} onClick={() => setTab('wish')}>위시리스트</button>
        <button type="button" className={`jp-tab ${tab === 'routes' ? 'on' : ''}`} onClick={() => setTab('routes')}>내 경로</button>
      </div>

      {tab === 'wish' ? (
        <>
          <Status loading={favLoading} empty={!favLoading && !favorites.length} emptyText="아직 담은 곳이 없어요. 사진 탐색에서 하트를 눌러 보세요." />
          <Row xs={1} sm={2} lg={4} className="g-3">
            {favorites.map((f) => (
              <Col key={f.id}>
                <div className="jp-photo">
                  <Link to={linkOf(f)} className="jp-photo-img">
                    {f.image ? <img src={f.image} alt={f.title} loading="lazy" /> : <div className="h-100 d-grid text-muted" style={{ placeItems: 'center' }}><i className="bi bi-geo-alt fs-1" /></div>}
                    <span className="jp-chip">{f.source === 'photo' ? '사진' : '장소'}</span>
                  </Link>
                  <button type="button" className="jp-heart on" aria-label="위시리스트에서 빼기" onClick={() => toggle({ source: f.source, id: f.item_id, title: f.title })}>
                    <i className="bi bi-heart-fill" />
                  </button>
                  <div className="jp-photo-body fw-semibold text-truncate">{f.title}</div>
                </div>
              </Col>
            ))}
          </Row>
        </>
      ) : (
        <>
          {!routes.length && <div className="text-center text-muted py-5">저장한 경로가 없어요. AI 가이드에서 코스를 만들고 저장해 보세요.</div>}
          <div className="d-grid gap-3">{routes.map((r) => <RouteCard key={r.id} route={r} />)}</div>
        </>
      )}
    </Container>
    </>
  )
}
