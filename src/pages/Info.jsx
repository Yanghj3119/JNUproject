import { useMemo, useState } from 'react'
import { Col, Container, Row } from 'react-bootstrap'
import { fetchHub } from '../api/client'
import { useAsync } from '../lib/useAsync'
import KakaoMap from '../components/KakaoMap'
import PageBanner from '../components/PageBanner'
import Status from '../components/Status'

// 제주데이터허브 데이터: 한라산 둘레길 · 교통(사고 다발지역·버스 정류소) · 숙박
const TABS = [
  { id: 'trail', label: '한라산 둘레길', icon: 'tree' },
  { id: 'traffic', label: '교통·안전', icon: 'bus-front' },
  { id: 'lodging', label: '숙박', icon: 'building' },
]

const LODGING_TYPES = ['가족호텔업', '관광호텔업', '소형호텔업', '의료관광호텔업', '호스텔업', '휴양콘도미니엄업']

const Select = ({ value, onChange, options, all = '전체', label }) => (
  <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} style={{ maxWidth: 220 }}>
    <option value="">{all}</option>
    {options.map((o) => <option key={o} value={o}>{o}</option>)}
  </select>
)

function TrailTab() {
  const { data, loading, error } = useAsync(() => fetchHub('trail'), [])
  return (
    <>
      <Status loading={loading} error={error} empty={!loading && !error && !data?.length}
        emptyText="받아온 코스가 없어요. 제주데이터허브 프로젝트에 '한라산 둘레길 코스별 정보' API 가 담겨 있는지 확인하세요. (/api/hub?kind=trail&debug=1 로 원본 응답을 볼 수 있어요)" />
      {data?.length > 0 && data.every((t) => !t.course) && (
        <div className="alert alert-warning small">데이터는 받았지만 항목 이름이 달라 표시하지 못했어요. <code>/api/hub?kind=trail&amp;debug=1</code> 결과를 확인해 주세요.</div>
      )}
      <Row xs={1} sm={2} lg={3} className="g-3">
        {data?.filter((t) => t.course).map((t, i) => (
          <Col key={`${t.course}-${i}`}>
            <div className="jp-tool">
              <i className="bi bi-tree" />
              <div className="fw-semibold mt-2">{t.course}</div>
              {t.km != null && <div className="fs-4 fw-bold lh-1 my-1">{t.km}<span className="fs-6 fw-normal text-muted"> km</span></div>}
              <div className="small text-muted"><i className="bi bi-geo-alt me-1" />{t.start || '-'} → {t.end || '-'}</div>
            </div>
          </Col>
        ))}
      </Row>
    </>
  )
}

function TrafficTab() {
  const [mode, setMode] = useState('accident') // 'accident' | 'busstop'
  const [sigungu, setSigungu] = useState('')
  const [name, setName] = useState('')
  const [q, setQ] = useState('')

  const accident = useAsync(() => (mode === 'accident' ? fetchHub('accident', { sigungu }) : null), [mode, sigungu])
  const stops = useAsync(() => (mode === 'busstop' && q ? fetchHub('busstop', { name: q }) : null), [mode, q])
  const cur = mode === 'accident' ? accident : stops

  const spots = useMemo(() => (cur.data ?? [])
    .filter((p) => p.lat > 33 && p.lng > 126)
    .map((p, i) => ({ id: p.id ?? `${mode}-${i}`, title: p.place ?? p.name, lat: p.lat, lng: p.lng, type: mode })), [cur.data, mode])

  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
        <div className="btn-group">
          <button type="button" className={`btn btn-sm ${mode === 'accident' ? 'btn-primary' : 'btn-outline-sea'}`} onClick={() => setMode('accident')}>교통사고 다발지역</button>
          <button type="button" className={`btn btn-sm ${mode === 'busstop' ? 'btn-primary' : 'btn-outline-sea'}`} onClick={() => setMode('busstop')}>버스 정류소</button>
        </div>
        {mode === 'accident'
          ? <Select value={sigungu} onChange={setSigungu} options={['제주시', '서귀포시']} all="제주 전체" label="시군구" />
          : (
            <form className="d-flex gap-2" onSubmit={(e) => { e.preventDefault(); setQ(name.trim()) }}>
              <input className="form-control" placeholder="정류소 이름 (예: 제주국제공항, 성산)" value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 240 }} />
              <button className="btn btn-primary" type="submit"><i className="bi bi-search" /></button>
            </form>
          )}
      </div>

      {mode === 'accident' && <p className="small text-muted">렌터카로 이동한다면 아래 구간에서는 특히 서행하세요. 발생 건수가 많은 순서예요.</p>}
      {mode === 'busstop' && !q && <p className="text-muted">정류소 이름을 검색해 보세요. 도착 시각은 제공되지 않고 위치·방향만 확인할 수 있어요.</p>}

      <Status loading={cur.loading} error={cur.error} empty={!cur.loading && !cur.error && (mode === 'accident' || q) && !cur.data?.length} emptyText="결과가 없어요" />
      {cur.data?.length > 0 && (
        <Row className="g-3">
          <Col lg={7}>
            <div className="table-responsive jp-panel p-0">
              {mode === 'accident' ? (
                <table className="table align-middle mb-0">
                  <thead><tr><th>지점</th><th className="text-end">발생</th><th className="text-end">사상자</th><th className="text-end">사망</th></tr></thead>
                  <tbody>{cur.data.map((a, i) => (
                    <tr key={i}><td><div className="fw-semibold">{a.place}</div><div className="small text-muted">{a.area}</div></td><td className="text-end">{a.count}</td><td className="text-end">{a.casualties}</td><td className="text-end">{a.deaths}</td></tr>
                  ))}</tbody>
                </table>
              ) : (
                <table className="table align-middle mb-0">
                  <thead><tr><th>정류소</th><th>방향</th><th>주소</th></tr></thead>
                  <tbody>{cur.data.map((s) => (
                    <tr key={s.id}><td className="fw-semibold">{s.name}<div className="small text-muted">ID {s.id}</div></td><td>{s.direction}</td><td className="small">{s.addr}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </Col>
          <Col lg={5}>
            <div className="jp-route-map rounded-3 overflow-hidden" style={{ height: 360 }}><KakaoMap spots={spots} /></div>
          </Col>
        </Row>
      )}
    </>
  )
}

function LodgingTab() {
  const [type, setType] = useState('')
  const [name, setName] = useState('')
  const [q, setQ] = useState('')
  const { data, loading, error } = useAsync(() => fetchHub('lodging', { type, name: q }), [type, q])
  return (
    <>
      <form className="d-flex flex-wrap gap-2 mb-3" onSubmit={(e) => { e.preventDefault(); setQ(name.trim()) }}>
        <Select value={type} onChange={setType} options={LODGING_TYPES} all="업종 전체" label="업종" />
        <input className="form-control" placeholder="숙소 이름 (선택)" value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 240 }} />
        <button className="btn btn-primary" type="submit"><i className="bi bi-search" /></button>
      </form>
      <p className="small text-muted">영업 중인 관광 숙박업만 보여요. 예약·요금 정보는 제공되지 않아요.</p>
      <Status loading={loading} error={error} empty={!loading && !error && !data?.length} emptyText="조건에 맞는 숙소가 없어요" />
      <div className="d-grid gap-2">
        {data?.map((l, i) => (
          <div key={`${l.name}-${i}`} className="jp-place">
            <div className="jp-place-img"><i className="bi bi-building text-jp" /></div>
            <div className="min-w-0 flex-grow-1">
              <div className="fw-semibold text-truncate">{l.name}</div>
              <div className="small text-muted text-truncate">{l.addr}</div>
              <div className="small mt-1">
                <span className="jp-tag" style={{ '--c': '#0e6f7a' }}>{l.type}</span>
                {l.rooms != null && <span className="ms-2 text-muted">객실 {l.rooms}개</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

export default function Info() {
  const [tab, setTab] = useState('trail')
  return (
    <>
      <PageBanner
        img="/images/jeju-stonewall.jpg" pos="50% 70%" eyebrow="여행 정보" title="떠나기 전에 확인하세요"
        sub="제주데이터허브 공공데이터로 한라산 둘레길, 교통 안전, 숙박을 확인해요."
      />
      <Container className="pt-4">
        <div className="jp-tabs" style={{ overflowX: 'auto' }}>
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`jp-tab ${tab === t.id ? 'on' : ''}`} style={{ whiteSpace: 'nowrap' }} onClick={() => setTab(t.id)}>
              <i className={`bi bi-${t.icon} me-1`} />{t.label}
            </button>
          ))}
        </div>

        {tab === 'trail' && <TrailTab />}
        {tab === 'traffic' && <TrafficTab />}
        {tab === 'lodging' && <LodgingTab />}
      </Container>
    </>
  )
}
