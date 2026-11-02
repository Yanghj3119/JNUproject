import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Col, Container, Row } from 'react-bootstrap'
import { fetchSpots, fetchWeather } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { PHOTO_THEMES, themeLabel, themesOf } from '../data/photoThemes'
import { mapToLink } from '../lib/kakaoGeo'
import { useAppStore } from '../store/useAppStore'
import KakaoMap from '../components/KakaoMap'
import PageBanner from '../components/PageBanner'
import Status from '../components/Status'

// 한국관광공사 관광지(사진이 있는 곳만)를 테마별 포토 스팟으로 보여 준다
function SpotCard({ spot, active, onSelect }) {
  const faved = useAppStore((s) => s.favorites.some((f) => f.source === 'place' && f.item_id === String(spot.id)))
  const toggle = useAppStore((s) => s.toggleFavorite)
  return (
    <div className={`jp-photo ${active ? 'jp-spot-on' : ''}`} onMouseEnter={onSelect}>
      <button type="button" className="jp-photo-img border-0 p-0 w-100" onClick={onSelect} aria-label={`${spot.title} 지도에서 보기`}>
        <img src={spot.image} alt={spot.title} loading="lazy" />
        <div className="jp-photo-hover">
          <div className="t">{spot.title}</div>
          <div className="m"><span><i className="bi bi-geo-alt me-1" />{spot.addr}</span></div>
          <div className="k">{spot.themes.map((t) => <span key={t}>{themeLabel(t)}</span>)}</div>
        </div>
      </button>
      <button type="button" className={`jp-heart ${faved ? 'on' : ''}`} aria-label="위시리스트에 담기"
        onClick={() => toggle({ source: 'place', id: spot.id, title: spot.title, image: spot.image })}>
        <i className={`bi bi-heart${faved ? '-fill' : ''}`} />
      </button>
      <div className="jp-photo-body">
        <div className="fw-semibold text-truncate">{spot.title}</div>
        <div className="small text-muted text-truncate">{spot.addr}</div>
        <div className="d-flex gap-2 mt-2">
          <Link className="btn btn-sm btn-primary flex-grow-1" to={`/agent?q=${encodeURIComponent(`${spot.title} 사진 찍기 좋은 시간대와 근처 코스를 알려줘`)}`}><i className="bi bi-stars me-1" />AI 코스</Link>
          <a className="btn btn-sm btn-outline-sea" target="_blank" rel="noreferrer" href={mapToLink(spot.title, spot.lat, spot.lng)} aria-label="길찾기"><i className="bi bi-signpost" /></a>
        </div>
      </div>
    </div>
  )
}

export default function PhotoSpots() {
  const [theme, setTheme] = useState('all')
  const [q, setQ] = useState('')
  const [selId, setSelId] = useState(null)

  // 관광지 최대 300곳(100개씩 3쪽)을 받아 이미지 있는 곳만 사용
  const all = useAsync(async () => {
    const pages = await Promise.all([1, 2, 3].map((p) => fetchSpots('12', p, 100).catch(() => [])))
    return pages.flat().filter((s) => s.image && s.lat > 33 && s.lng > 126)
  }, [])
  const sun = useAsync(() => fetchWeather({ place: '제주시' }), [])

  const spots = useMemo(() => {
    const seen = new Set()
    return (all.data ?? []).filter((s) => !seen.has(s.id) && seen.add(s.id)).map((s) => ({ ...s, themes: themesOf(s) }))
  }, [all.data])
  const counts = useMemo(() => Object.fromEntries(PHOTO_THEMES.map((t) => [t.id, spots.filter((s) => s.themes.includes(t.id)).length])), [spots])

  const list = useMemo(() => spots.filter((s) => (theme === 'all' || s.themes.includes(theme)) && (!q.trim() || s.title.includes(q.trim()))), [spots, theme, q])
  const pins = useMemo(() => list.slice(0, 120).map((s) => ({ id: s.id, title: s.title, lat: s.lat, lng: s.lng, type: '12' })), [list])
  const cur = PHOTO_THEMES.find((t) => t.id === theme)
  const s = sun.data?.sun

  return (
    <>
      <PageBanner
        img="/images/jeju-canola.jpg" pos="50% 68%" eyebrow="포토 스팟" title="제주 포토 스팟"
        sub="사진이 잘 나오는 명소를 테마별로 모았어요. 카드에 마우스를 올리면 정보가, 누르면 지도에 위치가 표시돼요."
      >
        {s?.sunrise && (
          <div className="jp-golden" title="일몰 한 시간 전부터가 가장 아름다운 시간대예요">
            <i className="bi bi-sunrise me-1" />일출 {s.sunrise}
            <i className="bi bi-sunset ms-3 me-1" />일몰 {s.sunset}
            <div className="small opacity-75">오늘 제주시 기준 · 일몰 1시간 전부터 황금빛</div>
          </div>
        )}
      </PageBanner>

      <Container className="pt-4">
        <div className="d-flex flex-wrap gap-2 mb-3">
          <button type="button" className={`jp-month ${theme === 'all' ? 'on' : ''}`} onClick={() => setTheme('all')}>전체 {spots.length || ''}</button>
          {PHOTO_THEMES.map((t) => (
            <button key={t.id} type="button" className={`jp-month ${theme === t.id ? 'on' : ''}`} onClick={() => setTheme(t.id)} disabled={!all.loading && !counts[t.id]}>
              <i className={`bi bi-${t.icon} me-1`} />{t.label} {counts[t.id] || ''}
            </button>
          ))}
        </div>
        <div className="d-flex flex-wrap gap-2 align-items-center mb-4">
          <input className="form-control" style={{ maxWidth: 280 }} placeholder="명소 이름 검색" value={q} onChange={(e) => setQ(e.target.value)} aria-label="명소 이름 검색" />
          <span className="small text-muted">{cur ? cur.desc : '제주 곳곳의 사진 명소'} · {list.length}곳</span>
        </div>

        <Status loading={all.loading} error={all.error} empty={!all.loading && !all.error && !list.length} emptyText="조건에 맞는 포토 스팟이 없어요" />

        {list.length > 0 && (
          <Row className="g-4">
            <Col lg={7} xl={8}>
              <Row xs={1} sm={2} xl={3} className="g-3">
                {list.slice(0, 60).map((sp) => <Col key={sp.id}><SpotCard spot={sp} active={sp.id === selId} onSelect={() => setSelId(sp.id)} /></Col>)}
              </Row>
              {list.length > 60 && <div className="small text-muted mt-3">상위 60곳만 보여요. 테마나 검색어로 좁혀 보세요.</div>}
            </Col>
            <Col lg={5} xl={4}>
              <div className="jp-sticky-map">
                <div className="jp-route-map rounded-3 overflow-hidden border" style={{ height: 460 }}>
                  <KakaoMap spots={pins} selectedId={selId} onSelect={(p) => setSelId(p?.id ?? null)} />
                </div>
                <div className="small text-muted mt-2">핀을 누르면 해당 카드가 강조돼요. 지도 핀은 최대 120곳까지 표시해요.</div>
              </div>
            </Col>
          </Row>
        )}
      </Container>
    </>
  )
}
