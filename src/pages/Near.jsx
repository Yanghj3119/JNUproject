import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Col, Container, Row } from 'react-bootstrap'
import { fetchNearby, fetchTransit, fetchWeather } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { distLabel } from '../lib/format'
import KakaoMap from '../components/KakaoMap'
import PageBanner from '../components/PageBanner'
import PlaceCard from '../components/PlaceCard'
import Status from '../components/Status'

// 위치 권한이 없거나 데스크톱에서 시연할 때 쓰는 대표 위치
const PRESETS = [
  { name: '제주국제공항', lat: 33.5113, lng: 126.493 },
  { name: '제주시청', lat: 33.4996, lng: 126.5312 },
  { name: '성산일출봉', lat: 33.458, lng: 126.9425 },
  { name: '협재해수욕장', lat: 33.394, lng: 126.2397 },
  { name: '서귀포 매일올레시장', lat: 33.2477, lng: 126.5636 },
]

const GEO_ERR = {
  1: '위치 권한이 거부됐어요. 브라우저 주소창의 자물쇠 아이콘에서 위치를 허용하거나, 아래 대표 위치를 골라 보세요.',
  2: '현재 위치를 알 수 없어요. 아래 대표 위치를 골라 보세요.',
  3: '위치 확인이 너무 오래 걸려요. 다시 시도하거나 대표 위치를 골라 보세요.',
}

function StopRow({ stop }) {
  const [open, setOpen] = useState(false)
  const arr = useAsync(() => (open ? fetchTransit('arrivals', { nodeId: stop.id }) : Promise.resolve(null)), [open, stop.id])
  return (
    <div className="border rounded-3 p-2 mb-2 bg-white">
      <button type="button" className="btn btn-link text-decoration-none text-start w-100 p-0 d-flex justify-content-between" onClick={() => setOpen((v) => !v)}>
        <span className="fw-semibold"><i className="bi bi-bus-front me-2" />{stop.name}{stop.no ? ` (${stop.no})` : ''}</span>
        <span className="small text-muted">{stop.dist != null ? distLabel(stop.dist) : ''} <i className={`bi bi-chevron-${open ? 'up' : 'down'}`} /></span>
      </button>
      {open && (
        <div className="small mt-2">
          {arr.loading && <span className="text-muted">도착 정보를 불러오는 중…</span>}
          {arr.error && <span className="text-danger">도착 정보를 가져오지 못했어요</span>}
          {arr.data && !arr.data.length && <span className="text-muted">지금 도착 예정인 버스가 없어요</span>}
          {arr.data?.slice(0, 6).map((a, i) => (
            <div key={`${a.routeId}-${i}`} className="d-flex justify-content-between">
              <span><b>{a.route}</b>번 {a.lowFloor && <span className="jp-tag" style={{ '--c': '#2563eb' }}>저상</span>}</span>
              <span>{a.minutes}분 · {a.stopsAway}정거장 전</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Near() {
  const [pos, setPos] = useState(null) // { lat, lng, name }
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [selId, setSelId] = useState(null)

  const locate = () => {
    setErr('')
    if (!navigator.geolocation) return setErr('이 브라우저는 위치 기능을 지원하지 않아요. 대표 위치를 골라 보세요.')
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setBusy(false)
        const here = { lat: p.coords.latitude, lng: p.coords.longitude, name: '내 위치' }
        // 제주 밖이면(시연·해외 접속) 결과가 비므로 안내
        if (here.lat < 33 || here.lat > 34 || here.lng < 126 || here.lng > 127.1) setErr('현재 위치가 제주 밖이에요. 대표 위치를 골라 보세요.')
        else setPos(here)
      },
      (e) => { setBusy(false); setErr(GEO_ERR[e.code] ?? GEO_ERR[2]) },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    )
  }

  const data = useAsync(async () => {
    if (!pos) return null
    const [places, stops, wx] = await Promise.all([
      fetchNearby({ lat: pos.lat, lng: pos.lng, radius: 5000, type: '12' }).catch(() => []),
      fetchTransit('near', { lat: pos.lat, lng: pos.lng }).catch(() => []),
      fetchWeather({ lat: pos.lat, lng: pos.lng }).catch(() => null),
    ])
    return { places, stops, wx }
  }, [pos?.lat, pos?.lng])

  const pins = [
    ...(data.data?.places ?? []).map((p) => ({ id: p.id, title: p.title, lat: p.lat, lng: p.lng, type: '12' })),
  ]
  const now = data.data?.wx?.now ?? data.data?.wx?.current

  return (
    <>
      <PageBanner img="/images/jeju-canola.jpg" pos="50% 60%" eyebrow="내 주변" title="내 주변 찾기"
        sub="지금 있는 곳 근처의 관광지, 버스 정류소와 실시간 도착 정보, 날씨를 한 번에 보여 줘요." />
      <Container className="pt-4">
        <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
          <button type="button" className="btn btn-primary" onClick={locate} disabled={busy}>
            <i className="bi bi-crosshair me-1" />{busy ? '위치 확인 중…' : '내 위치로 찾기'}
          </button>
          <span className="small text-muted">또는 대표 위치:</span>
          {PRESETS.map((p) => (
            <button key={p.name} type="button" className={`jp-month ${pos?.name === p.name ? 'on' : ''}`} onClick={() => { setErr(''); setPos(p) }}>{p.name}</button>
          ))}
        </div>
        <div className="small text-muted mb-3">위치 정보는 주변 검색에만 쓰이고 저장하지 않아요. 카카오톡 앱 안에서 열면 위치가 막힐 수 있어요. 그때는 크롬·사파리로 열어 주세요.</div>
        {err && <div className="alert alert-warning py-2">{err}</div>}

        {!pos && !err && <div className="text-muted py-5 text-center"><i className="bi bi-geo-alt fs-1 d-block mb-2" />위치를 선택하면 주변 정보를 보여 드려요</div>}
        {pos && <Status loading={data.loading} error={data.error} />}

        {pos && data.data && (
          <Row className="g-4">
            <Col lg={7}>
              <h5 className="mb-2"><i className="bi bi-geo-alt-fill me-1 text-primary" />{pos.name} 기준
                {now && <span className="small text-muted ms-2">{now.temp != null ? `${now.temp}°` : ''} {now.sky ?? ''}</span>}
              </h5>

              <h6 className="mt-3">가까운 정류소 <span className="small text-muted">누르면 실시간 도착 정보</span></h6>
              {data.data.stops.length ? data.data.stops.map((s) => <StopRow key={s.id} stop={s} />) : <div className="small text-muted mb-2">근처 정류소 정보가 없어요</div>}

              <h6 className="mt-4">가까운 관광지</h6>
              {data.data.places.length
                ? data.data.places.map((p) => <PlaceCard key={p.id} place={p} />)
                : <div className="small text-muted">반경 5km 안에 등록된 관광지가 없어요</div>}
              <Link className="btn btn-outline-sea mt-3" to={`/agent?q=${encodeURIComponent(`${pos.name === '내 위치' ? '지금 내 주변' : pos.name + ' 근처'}에서 걸어서 갈 만한 곳으로 반나절 코스를 짜줘`)}`}>
                <i className="bi bi-stars me-1" />이 위치로 AI 코스 만들기
              </Link>
            </Col>
            <Col lg={5}>
              <div className="jp-sticky-map">
                <div className="jp-route-map rounded-3 overflow-hidden border" style={{ height: 460 }}>
                  <KakaoMap spots={pins} selectedId={selId} onSelect={(p) => setSelId(p?.id ?? null)} />
                </div>
                <div className="small text-muted mt-2">관광지 핀을 누르면 위치가 강조돼요</div>
              </div>
            </Col>
          </Row>
        )}
      </Container>
    </>
  )
}
