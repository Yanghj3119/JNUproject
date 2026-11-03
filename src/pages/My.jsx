import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Col, Container, Row } from 'react-bootstrap'
import { useAppStore } from '../store/useAppStore'
import { displayName } from '../lib/format'
import { isSupabaseReady } from '../lib/supabase'
import { listSpots, removeSpot } from '../lib/userSpots'
import KakaoMap from '../components/KakaoMap'
import PageBanner from '../components/PageBanner'
import ShareButton from '../components/ShareButton'
import { routeShareUrl } from '../lib/share'
import { searchJejuPlaces } from '../lib/kakaoGeo'
import Status from '../components/Status'

const MAX_PICK = 6 // 코스 하나에 넣을 장소 수 (많을수록 AI가 오래 걸리고 실패하기 쉬워서 6곳까지로 제한한다)

// 일정 설정 — AI 에게 "하루 코스" 또는 "일차별 코스"로 만들어 달라고 알려 준다
const PLAN_DAYS = [
  { id: 'auto', label: '알아서', ask: '하루에 가기 너무 멀면 일차별로 나눠서 제안해줘.' },
  { id: 'day', label: '당일', ask: '하루(당일) 코스로 만들어줘. 하루에 다 못 가는 곳은 말로 알려줘.' },
  { id: '2d', label: '1박 2일', ask: '1박 2일(2일차)로 나눠서 제안해줘.' },
  { id: '3d', label: '2박 3일', ask: '2박 3일(3일차)로 나눠서 제안해줘.' },
]

// 위시리스트를 AI 가이드에게 넘기는 질문. 미리 찾아 둔 좌표가 있는 곳은 AI 가 다시 찾지 않고 그 좌표를 그대로 쓰게 한다.
// 사진 제목("다랑쉬오름의 아침")처럼 좌표를 못 찾은 곳만 AI 가 실제 장소를 확인한다.
const wishlistPrompt = (items, days = 'auto') =>
  `내 위시리스트에 담은 곳이야: ${items.map((f) => (f.lat ? `${f.title}(${f.addr || '제주'}, 위도 ${f.lat.toFixed(5)}, 경도 ${f.lng.toFixed(5)})` : f.title)).join(', ')}. ` +
  '이 장소들을 모두 넣어서 가까운 순서로 방문 코스를 만들어줘. 위도·경도가 함께 적힌 곳은 도구로 다시 찾지 말고 그 좌표를 코스(propose_route)의 lat/lng 로 그대로 넣어줘. 좌표가 없는 곳만 실제 장소를 확인해서 넣고, 못 찾는 곳은 말로 알려줘. ' +
  `날씨와 이동 거리도 함께 알려주고, ${(PLAN_DAYS.find((d) => d.id === days) ?? PLAN_DAYS[0]).ask}`

// 카카오 장소 검색으로 위시리스트 장소의 좌표를 미리 찾는다 (이름이 비슷하게 일치하는 결과만 쓴다)
const sameName = (a, b) => { const n = (t) => String(t).replace(/[\s·()-]/g, ''); return n(a).includes(n(b)) || n(b).includes(n(a)) }
async function withCoords(items) {
  return Promise.all(items.map(async (f) => {
    const hit = (await searchJejuPlaces(f.title, 3).catch(() => [])).find((r) => r.lat && sameName(r.title, f.title))
    return hit ? { ...f, addr: hit.addr, lat: hit.lat, lng: hit.lng } : f
  }))
}

const dateOf =(iso) => new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

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
          <ShareButton getContent={() => ({ title: route.title, description: stops.map((s) => s.name).join(' → '), url: routeShareUrl({ title: route.title, stops }) })} />
          <button className="btn btn-sm btn-outline-sea" onClick={() => setOpen(!open)}>{open ? '접기' : '지도로 보기'}</button>
          <button className="btn btn-sm btn-outline-sea" aria-label="경로 삭제" onClick={() => window.confirm('이 경로를 삭제할까요?') && del(route.id)}><i className="bi bi-trash" /></button>
        </div>
      </div>
      <div className="small mt-2 text-muted">{stops.map((s) => s.name).join(' → ')}</div>
      {open && (
        <div className="mt-3">
          <div className="jp-route-map rounded-3 overflow-hidden"><KakaoMap route={stops} profile="driving" /></div>
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
  const [tab, setTab] = useState('wish') // 'wish' | 'routes' | 'photos'

  // 내가 포토 스팟에 올린 사진 (Supabase user_spots) — 여기서 완전히 삭제할 수 있다
  const [photos, setPhotos] = useState([])
  const [photosLoading, setPhotosLoading] = useState(true)
  const [photoErr, setPhotoErr] = useState('')
  const [photoMsg, setPhotoMsg] = useState('')
  const loadPhotos = () => listSpots()
    .then((all) => setPhotos(all.filter((p) => p.user_id === user?.id)))
    .catch(() => setPhotos([])) // 테이블을 아직 안 만들었으면 조용히 비워 둔다
    .finally(() => setPhotosLoading(false))
  useEffect(() => { if (user) loadPhotos(); else setPhotosLoading(false) }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const deletePhoto = async (p) => {
    if (!window.confirm(`"${p.title}" 사진을 포토 스팟에서 완전히 삭제할까요? (사진 파일도 함께 지워져요)`)) return
    setPhotoErr(''); setPhotoMsg('')
    try { await removeSpot(p); setPhotoMsg('삭제했어요. 사진 파일도 함께 지웠어요.'); await loadPhotos() } catch (e) { setPhotoErr(e.message) }
  }

  // AI 코스에 넘길 위시리스트: 기본은 앞에서 8곳, 카드의 체크박스로 빼거나 다시 넣는다
  const [off, setOff] = useState(() => new Set())
  const chosen = favorites.filter((f) => !off.has(f.id)).slice(0, MAX_PICK)
  const chosenIds = new Set(chosen.map((f) => f.id))
  const togglePick = (f) => {
    if (chosenIds.has(f.id)) setOff((s) => new Set(s).add(f.id))
    else if (chosen.length < MAX_PICK) setOff((s) => { const n = new Set(s); n.delete(f.id); return n })
  }
  const nav = useNavigate()
  const [days, setDays] = useState('auto')
  const [planning, setPlanning] = useState(false)
  const makePlan = async () => {
    if (!chosen.length) return nav('/agent')
    setPlanning(true)
    try { nav(`/agent?q=${encodeURIComponent(wishlistPrompt(await withCoords(chosen), days))}`) } finally { setPlanning(false) }
  }

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

  const name = displayName(user)

  return (
    <>
    <PageBanner img="/images/jeju-chairs.jpg" pos="50% 55%" eyebrow="내 보관함" title={`${name}님의 여행`}
      sub={`위시리스트 ${favorites.length}개 · 저장한 경로 ${routes.length}개 · 올린 사진 ${photos.length}장`}>
      <button type="button" onClick={makePlan} disabled={planning} className="btn btn-light"><i className="bi bi-stars me-1" />{planning ? '장소 확인 중…' : chosen.length ? `위시리스트 ${chosen.length}곳으로 코스 만들기` : 'AI에게 코스 물어보기'}</button>
    </PageBanner>
    <Container className="pt-4">
      <div className="jp-tabs" style={{ maxWidth: 520 }}>
        <button type="button" className={`jp-tab ${tab === 'wish' ? 'on' : ''}`} onClick={() => setTab('wish')}>위시리스트</button>
        <button type="button" className={`jp-tab ${tab === 'routes' ? 'on' : ''}`} onClick={() => setTab('routes')}>내 경로</button>
        <button type="button" className={`jp-tab ${tab === 'photos' ? 'on' : ''}`} onClick={() => setTab('photos')}>내 사진 {photos.length || ''}</button>
      </div>

      {tab === 'wish' ? (
        <>
          <Status loading={favLoading} empty={!favLoading && !favorites.length} emptyText="아직 담은 곳이 없어요. 사진 탐색에서 하트를 눌러 보세요." />
          {favorites.length > 0 && (
            <div className="d-flex flex-wrap align-items-center gap-2 mb-3 p-3 rounded-3 border bg-white">
              <div className="flex-grow-1 small">
                <div className="fw-semibold"><i className="bi bi-check2-square me-1" />코스에 넣을 곳 {chosen.length}/{Math.min(favorites.length, MAX_PICK)}</div>
                <div className="text-muted">카드의 체크를 눌러 빼거나 넣을 수 있어요. 최대 {MAX_PICK}곳까지 한 코스로 만들어요.</div>
              </div>
              <select className="form-select form-select-sm" style={{ width: 120 }} value={days} onChange={(e) => setDays(e.target.value)} aria-label="코스 일정">
                {PLAN_DAYS.map((d) => <option key={d.id} value={d.id}>{d.id === 'auto' ? '일정: 알아서' : `일정: ${d.label}`}</option>)}
              </select>
              <button type="button" onClick={makePlan} disabled={!chosen.length || planning} className="btn btn-primary"><i className="bi bi-stars me-1" />{planning ? '장소 확인 중…' : 'AI에게 이 곳들로 코스 만들기'}</button>
            </div>
          )}
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
                  <label className="jp-photo-body fw-semibold d-flex align-items-center gap-2 mb-0" style={{ cursor: 'pointer' }}>
                    <input type="checkbox" className="form-check-input mt-0 flex-none" checked={chosenIds.has(f.id)} onChange={() => togglePick(f)}
                      disabled={!chosenIds.has(f.id) && chosen.length >= MAX_PICK} aria-label={`${f.title} 코스에 넣기`} />
                    <span className="text-truncate">{f.title}</span>
                  </label>
                </div>
              </Col>
            ))}
          </Row>
        </>
      ) : tab === 'photos' ? (
        <>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
            <span className="small text-muted">포토 스팟에 올린 내 사진이에요. 삭제하면 사진 파일도 함께 지워져요.</span>
            <Link to="/spots/upload" className="btn btn-sm btn-primary ms-auto"><i className="bi bi-cloud-arrow-up me-1" />사진 올리기</Link>
          </div>
          {photoErr && <div className="alert alert-warning py-2">{photoErr}</div>}
          {photoMsg && <div className="alert alert-success py-2">{photoMsg}</div>}
          <Status loading={photosLoading} empty={!photosLoading && !photos.length} emptyText="아직 올린 사진이 없어요. '사진 올리기'로 포토 스팟에 내 사진을 올려 보세요." />
          <Row xs={1} sm={2} lg={4} className="g-3">
            {photos.map((p) => (
              <Col key={p.id}>
                <div className="jp-photo">
                  <div className="jp-photo-img"><img src={p.url} alt={p.title} loading="lazy" /><span className="jp-chip">내 사진</span></div>
                  <div className="jp-photo-body">
                    <div className="fw-semibold text-truncate">{p.title}</div>
                    <div className="small text-muted text-truncate">{p.place_name}</div>
                    <div className="small text-muted">{dateOf(p.created_at)}</div>
                    <div className="d-flex gap-2 mt-2">
                      <Link className="btn btn-sm btn-outline-sea flex-grow-1" to="/spots"><i className="bi bi-camera me-1" />포토 스팟에서 보기</Link>
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deletePhoto(p)} aria-label={`${p.title} 삭제`}><i className="bi bi-trash" /></button>
                    </div>
                  </div>
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
