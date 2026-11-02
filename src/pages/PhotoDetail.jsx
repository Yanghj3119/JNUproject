import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Col, Container, Row } from 'react-bootstrap'
import { fetchAccess, fetchNearby, fetchPhotoInfo, fetchRelated } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { monthOf, seasonOf } from '../lib/format'
import { useAppStore } from '../store/useAppStore'
import PlaceCard from '../components/PlaceCard'
import Status from '../components/Status'
import WeatherBadge from '../components/WeatherBadge'

// 사진 한 장 → get_photo_info(촬영지·시기) → 그 장소의 날씨 · 주변 명소(find_nearby) · 무장애 · 연관 관광지
export default function PhotoDetail() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const title = sp.get('title') ?? ''
  const location = sp.get('loc') ?? ''
  const [picked, setPicked] = useState(0)

  const faved = useAppStore((s) => s.favorites.some((f) => f.source === 'photo' && f.item_id === String(id)))
  const toggle = useAppStore((s) => s.toggleFavorite)

  const info = useAsync(() => fetchPhotoInfo({ id, title, location }), [id, title, location])
  const place = info.data?.place
  const photo = info.data?.photo
  const gallery = info.data?.gallery?.length ? info.data.gallery : photo ? [photo] : []
  const shown = gallery[picked] ?? photo

  const nearby = useAsync(() => (place ? fetchNearby({ lat: place.lat, lng: place.lng, exclude: place.id }) : null), [place?.id])
  const access = useAsync(() => (place ? fetchAccess({ contentId: place.id }) : null), [place?.id])
  const related = useAsync(() => (place ? fetchRelated({ name: place.title, addr: place.addr }) : null), [place?.id])

  const month = monthOf(photo?.month)

  if (info.loading || info.error) {
    return <Container className="py-4"><Status loading={info.loading} error={info.error} /></Container>
  }

  return (
    <Container className="py-4">
      <Link to="/explore" className="text-decoration-none small"><i className="bi bi-arrow-left me-1" />사진 탐색으로</Link>

      <Row className="g-4 mt-1">
        <Col lg={7}>
          <div className="jp-detail-hero">
            {shown?.image ? <img src={shown.image} alt={shown.title} /> : <div className="p-5 text-center text-muted">사진이 없어요</div>}
          </div>
          {gallery.length > 1 && (
            <div className="jp-thumbs">
              {gallery.map((g, i) => <img key={g.id || i} src={g.image} alt="" className={i === picked ? 'on' : ''} onClick={() => setPicked(i)} />)}
            </div>
          )}
        </Col>

        <Col lg={5}>
          <div className="d-flex justify-content-between align-items-start gap-2">
            <h1 className="h3 fw-bold">{photo?.title || title}</h1>
            <button type="button" className={`btn btn-sm jp-iconbtn fs-4 ${faved ? 'on' : ''}`} aria-label="보관함에 담기"
              onClick={() => toggle({ source: 'photo', id, title: photo?.title || title, image: shown?.image })}>
              <i className={`bi bi-heart${faved ? '-fill' : ''}`} />
            </button>
          </div>

          <div className="jp-panel mb-3">
            <div className="mb-2"><i className="bi bi-geo-alt text-jp me-2" /><strong>촬영지</strong> {photo?.location || place?.title || '정보 없음'}</div>
            <div className="mb-2">
              <i className="bi bi-calendar-heart text-jp me-2" /><strong>촬영 시기</strong>{' '}
              {month ? `${month}월 (${seasonOf(month)})` : '정보 없음'}
              {month > 0 && <span className="small text-muted ms-2">이 시기에 가면 사진 속 풍경을 만날 수 있어요</span>}
            </div>
            {photo?.photographer && <div className="small text-muted"><i className="bi bi-person me-2" />촬영 {photo.photographer}</div>}
          </div>

          {place ? (
            <>
              <div className="jp-panel mb-3">
                <div className="fw-semibold mb-1">{place.title}</div>
                <div className="small text-muted mb-2">{place.addr}</div>
                {place.overview && <p className="small mb-2">{place.overview.slice(0, 220)}{place.overview.length > 220 ? '…' : ''}</p>}
                <div className="d-flex flex-wrap gap-2">
                  <a className="btn btn-sm btn-outline-sea" target="_blank" rel="noreferrer"
                    href={`https://map.kakao.com/link/to/${encodeURIComponent(place.title)},${place.lat},${place.lng}`}>
                    <i className="bi bi-sign-turn-right me-1" />길찾기
                  </a>
                  <Link className="btn btn-sm btn-outline-sea" to="/map"><i className="bi bi-globe-asia-australia me-1" />3D 지도</Link>
                </div>
              </div>
              <WeatherBadge lat={place.lat} lng={place.lng} variant="card" />
            </>
          ) : (
            <div className="alert alert-light small mb-0">이 사진의 촬영지에 해당하는 관광지를 찾지 못해 주변 정보는 보여드리지 못해요.</div>
          )}
        </Col>
      </Row>

      {place && (
        <Row className="g-4 mt-1">
          <Col lg={7}>
            <h2 className="h5 jp-section-title mb-3"><i className="bi bi-signpost-split text-jp me-2" />주변 명소</h2>
            <Status loading={nearby.loading} error={nearby.error} empty={!nearby.loading && !nearby.error && !nearby.data?.length} emptyText="주변 명소가 없어요" compact />
            <div className="d-grid gap-2">{nearby.data?.map((p) => <PlaceCard key={p.id} place={p} />)}</div>
          </Col>

          <Col lg={5}>
            <h2 className="h5 jp-section-title mb-3"><i className="bi bi-universal-access text-jp me-2" />무장애 정보</h2>
            <div className="jp-panel mb-4">
              <Status loading={access.loading} error={access.error} empty={!access.loading && !access.error && !access.data?.items?.length} emptyText={access.data?.note || '등록된 정보가 없어요'} compact />
              <div className="jp-access">
                {access.data?.items?.map((a) => <div key={a.key}><strong>{a.label}</strong><div className="text-muted">{a.value}</div></div>)}
              </div>
            </div>

            <h2 className="h5 jp-section-title mb-3"><i className="bi bi-diagram-3 text-jp me-2" />함께 가는 곳</h2>
            <div className="jp-panel">
              <Status loading={related.loading} error={related.error} empty={!related.loading && !related.error && !related.data?.length} emptyText="연관 관광지 정보가 없어요" compact />
              <ol className="mb-0 ps-3">
                {related.data?.map((r, i) => (
                  <li key={`${r.name}-${i}`}>
                    <Link to={`/explore?q=${encodeURIComponent(r.name)}`} className="text-decoration-none fw-semibold">{r.name}</Link>
                    <span className="small text-muted ms-2">{r.area}{r.category ? ` · ${r.category}` : ''}</span>
                  </li>
                ))}
              </ol>
            </div>
          </Col>
        </Row>
      )}
    </Container>
  )
}
