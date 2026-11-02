import { Link } from 'react-router-dom'
import { Col, Container, Row } from 'react-bootstrap'
import { useAppStore } from '../store/useAppStore'
import { isSupabaseReady } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import Status from '../components/Status'

export default function My() {
  const nickname = useAppStore((s) => s.nickname)
  const setNickname = useAppStore((s) => s.setNickname)
  const favorites = useAppStore((s) => s.favorites)
  const favLoading = useAppStore((s) => s.favLoading)
  const toggle = useAppStore((s) => s.toggleFavorite)

  const linkOf = (f) => (f.source === 'photo'
    ? `/photo/${encodeURIComponent(f.item_id)}?${new URLSearchParams({ title: f.title })}`
    : `/explore?q=${encodeURIComponent(f.title)}`)

  return (
    <Container>
      <PageHeader icon="bookmark-heart" title="내 보관함" sub="마음에 든 사진과 장소를 담아 두세요. 닉네임별로 저장돼요." />

      {!isSupabaseReady && (
        <div className="alert alert-warning">Supabase 설정(<code>.env.local</code>)이 없어서 보관함을 쓸 수 없어요. README 를 참고하세요.</div>
      )}

      <div className="jp-panel mb-4 d-flex flex-wrap align-items-center gap-3">
        <label className="fw-semibold" htmlFor="nick"><i className="bi bi-person-circle me-1 text-jp" />닉네임</label>
        <input id="nick" className="form-control rounded-pill" style={{ maxWidth: 260 }} placeholder="익명" defaultValue={nickname}
          onBlur={(e) => setNickname(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
        <span className="small text-muted">바꾸면 그 닉네임의 보관함이 열려요</span>
      </div>

      <Status loading={favLoading} empty={!favLoading && !favorites.length} emptyText="아직 담은 곳이 없어요. 사진 탐색에서 하트를 눌러 보세요!" />
      <Row xs={1} sm={2} lg={4} className="g-3">
        {favorites.map((f) => (
          <Col key={f.id}>
            <div className="jp-photo">
              <Link to={linkOf(f)} className="jp-photo-img">
                {f.image ? <img src={f.image} alt={f.title} loading="lazy" /> : <div className="h-100 d-grid place-items-center text-muted"><i className="bi bi-geo-alt fs-1" /></div>}
                <span className="jp-chip">{f.source === 'photo' ? '사진' : '장소'}</span>
              </Link>
              <button type="button" className="jp-heart on" aria-label="보관함에서 빼기" onClick={() => toggle({ source: f.source, id: f.item_id, title: f.title })}>
                <i className="bi bi-heart-fill" />
              </button>
              <div className="jp-photo-body fw-semibold text-truncate">{f.title}</div>
            </div>
          </Col>
        ))}
      </Row>
    </Container>
  )
}
