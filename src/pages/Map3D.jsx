import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Col, Container, Row } from 'react-bootstrap'
import { fetchAccess, fetchNearby, fetchSpots, fetchWeather } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { TYPE_META, typeMeta } from '../lib/format'
import PageHeader from '../components/PageHeader'
import Jeju3D from '../components/Jeju3D'
import KakaoMap from '../components/KakaoMap'
import PlaceCard from '../components/PlaceCard'
import Status from '../components/Status'
import WeatherBadge from '../components/WeatherBadge'

const TYPES = ['12', '14', '15', '39', 'oreum', 'museum', 'souvenir'] // 숫자: 한국관광공사 / 문자: 제주데이터허브

export default function Map3D() {
  const [type, setType] = useState('12')
  const [sel, setSel] = useState(null)
  const [view, setView] = useState('3d') // '3d' | 'map'

  const spots = useAsync(() => fetchSpots(type), [type])
  const weather = useAsync(() => fetchWeather({ place: '제주시' }), [])
  const nearby = useAsync(() => (sel ? fetchNearby({ lat: sel.lat, lng: sel.lng, radius: 2000, exclude: sel.id }) : null), [sel?.id])
  // 무장애 정보는 한국관광공사 장소(contentId)만 조회 가능 — 제주데이터허브 장소(hub)는 건너뜀
  const access = useAsync(() => (sel && !sel.hub ? fetchAccess({ contentId: sel.id }) : null), [sel?.id])

  return (
    <Container>
      <PageHeader icon="globe-asia-australia" title="제주 지도" sub="핀을 눌러 명소의 날씨·주변 명소·무장애 정보를 확인하세요.">
        <div className="btn-group" role="group" aria-label="지도 보기 방식">
          <button type="button" className={`btn btn-sm ${view === '3d' ? 'btn-primary' : 'btn-outline-sea'}`} onClick={() => setView('3d')}><i className="bi bi-badge-3d me-1" />3D</button>
          <button type="button" className={`btn btn-sm ${view === 'map' ? 'btn-primary' : 'btn-outline-sea'}`} onClick={() => setView('map')}><i className="bi bi-map me-1" />지도</button>
        </div>
      </PageHeader>

      <Row className="g-3">
        <Col lg={8}>
          <div className="jp-map">
            <div className="jp-map-chips">
              {TYPES.map((t) => (
                <button key={t} type="button" className={`jp-month ${type === t ? 'on' : ''}`} onClick={() => { setType(t); setSel(null) }}>
                  <i className={`bi bi-${TYPE_META[t].icon} me-1`} />{TYPE_META[t].label}
                </button>
              ))}
            </div>
            {view === '3d'
              ? <Jeju3D spots={spots.data ?? []} selectedId={sel?.id} onSelect={setSel} weather={weather.data?.now} />
              : <KakaoMap spots={spots.data ?? []} selectedId={sel?.id} onSelect={setSel} />}
            <div className="jp-map-hint">
              {view === '3d'
                ? <><i className="bi bi-mouse me-1" />드래그: 회전 · 휠: 확대 · 핀: 선택 · 날씨에 따라 하늘이 바뀌어요</>
                : <><i className="bi bi-hand-index me-1" />핀을 눌러 선택하세요</>}
            </div>
          </div>
          <Status loading={spots.loading} error={spots.error} empty={!spots.loading && !spots.error && !spots.data?.length} emptyText="표시할 장소가 없어요" compact />
        </Col>

        <Col lg={4}>
          <div className="jp-panel jp-side">
            {!sel ? (
              <div className="text-center text-muted py-5">
                <i className="bi bi-hand-index display-5 text-jp" />
                <p className="mt-2 mb-0">지도에서 핀을 눌러 보세요.<br /><small>{spots.data ? `${spots.data.length}곳이 표시되어 있어요` : ''}</small></p>
              </div>
            ) : (
              <>
                {sel.image && <img className="cover mb-3" src={sel.image} alt={sel.title} />}
                <span className="jp-tag" style={{ '--c': typeMeta(sel.type).color }}>{typeMeta(sel.type).label}</span>
                <h2 className="h5 fw-bold mt-2 mb-1">{sel.title}</h2>
                <div className="small text-muted mb-3">{sel.addr}</div>

                <WeatherBadge lat={sel.lat} lng={sel.lng} variant="card" />

                <div className="d-flex gap-2 my-3">
                  <Link className="btn btn-sm btn-primary" to={`/explore?q=${encodeURIComponent(sel.title)}`}><i className="bi bi-images me-1" />사진 보기</Link>
                  <a className="btn btn-sm btn-outline-sea" target="_blank" rel="noreferrer"
                    href={`https://map.kakao.com/link/to/${encodeURIComponent(sel.title)},${sel.lat},${sel.lng}`}><i className="bi bi-sign-turn-right me-1" />길찾기</a>
                </div>

                {sel.hub ? (
                  sel.url && <a className="btn btn-sm btn-outline-sea mb-3" target="_blank" rel="noreferrer" href={sel.url}><i className="bi bi-map me-1" />카카오맵에서 보기</a>
                ) : (
                  <>
                    <h3 className="h6 fw-bold"><i className="bi bi-universal-access text-jp me-1" />무장애 정보</h3>
                    <Status loading={access.loading} error={access.error} empty={!access.loading && !access.error && !access.data?.items?.length} emptyText="등록된 정보가 없어요" compact />
                    <div className="jp-access mb-3">
                      {access.data?.items?.slice(0, 6).map((a) => <div key={a.key}><strong>{a.label}</strong><div className="text-muted">{a.value}</div></div>)}
                    </div>
                  </>
                )}

                <h3 className="h6 fw-bold"><i className="bi bi-signpost-split text-jp me-1" />주변 2km</h3>
                <Status loading={nearby.loading} error={nearby.error} empty={!nearby.loading && !nearby.error && !nearby.data?.length} emptyText="주변 명소가 없어요" compact />
                <div className="d-grid gap-2">{nearby.data?.slice(0, 5).map((p) => <PlaceCard key={p.id} place={p} />)}</div>
              </>
            )}
          </div>
        </Col>
      </Row>
    </Container>
  )
}
