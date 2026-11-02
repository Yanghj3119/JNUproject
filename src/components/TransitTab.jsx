import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Col, Row } from 'react-bootstrap'
import { fetchTransit } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { mapToLink } from '../lib/kakaoGeo'
import KakaoMap from './KakaoMap'
import Status from './Status'

// 일정 시간마다 숫자를 올려서 useAsync 가 다시 불러오게 하는 훅 (실시간 정보 자동 갱신)
function useTick(ms) {
  const [n, setN] = useState(0)
  useEffect(() => { const t = setInterval(() => setN((x) => x + 1), ms); return () => clearInterval(t) }, [ms])
  return n
}

const nowKst = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(11, 16)

// ── 정류소 → 실시간 도착 정보 (30초마다 갱신) ───────────────────
function BusArrivals() {
  const [name, setName] = useState('제주국제공항')
  const [q, setQ] = useState('제주국제공항')
  const [stopId, setStopId] = useState(null)
  const tick = useTick(30000)

  const stops = useAsync(() => fetchTransit('stops', { name: q }), [q])
  const list = stops.data ?? []
  const cur = list.find((s) => s.id === stopId) ?? list[0]
  const arr = useAsync(() => (cur ? fetchTransit('arrivals', { nodeId: cur.id }) : null), [cur?.id, tick])
  const pins = useMemo(() => list.filter((s) => s.lat > 33).map((s) => ({ id: s.id, title: s.name, lat: s.lat, lng: s.lng, type: 'busstop' })), [list])

  return (
    <>
      <form className="d-flex gap-2 mb-3" onSubmit={(e) => { e.preventDefault(); setStopId(null); setQ(name.trim()) }}>
        <input className="form-control" style={{ maxWidth: 280 }} placeholder="정류소 이름 (예: 제주국제공항, 성산, 동문)" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-primary" type="submit" aria-label="검색"><i className="bi bi-search" /></button>
      </form>
      <Status loading={stops.loading} error={stops.error} empty={!stops.loading && !stops.error && !list.length} emptyText="정류소를 찾지 못했어요. 이름 일부만 입력해 보세요 (예: 공항)" />
      {list.length > 0 && (
        <Row className="g-3">
          <Col lg={5}>
            <div className="jp-panel p-0" style={{ maxHeight: 440, overflowY: 'auto' }}>
              {list.map((s) => (
                <button key={s.id} type="button" className={`jp-listbtn ${cur?.id === s.id ? 'on' : ''}`} onClick={() => setStopId(s.id)}>
                  <i className="bi bi-bus-front text-jp me-2" />{s.name}
                </button>
              ))}
            </div>
          </Col>
          <Col lg={7}>
            <div className="jp-panel mb-2">
              <div className="d-flex justify-content-between align-items-start">
                <div><div className="jp-eyebrow">실시간 도착 · 30초마다 갱신</div><h2 className="h5 fw-bold mb-2">{cur?.name}</h2></div>
                {cur && <a className="btn btn-sm btn-outline-sea" target="_blank" rel="noreferrer" href={mapToLink(cur.name, cur.lat, cur.lng)}><i className="bi bi-signpost me-1" />길찾기</a>}
              </div>
              <Status loading={arr.loading && !arr.data} error={arr.error} empty={!arr.loading && !arr.error && !arr.data?.length} emptyText="지금 도착 예정인 버스가 없어요 (운행이 끝난 시간일 수 있어요)" compact />
              {arr.data?.length > 0 && (
                <table className="table align-middle mb-0">
                  <thead><tr><th>노선</th><th>도착</th><th>남은 정류장</th></tr></thead>
                  <tbody>{arr.data.map((a, i) => (
                    <tr key={`${a.routeId}-${i}`}>
                      <td><span className="badge text-bg-dark me-2">{a.route}</span><span className="small text-muted">{a.type}</span>{a.lowFloor && <i className="bi bi-person-wheelchair ms-2 text-jp" title="저상버스" />}</td>
                      <td className="fw-semibold">{a.minutes <= 1 ? '곧 도착' : `${a.minutes}분 후`}</td>
                      <td className="text-muted">{a.stopsAway}정거장 전</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
            <div className="jp-route-map rounded-3 overflow-hidden border" style={{ height: 240 }}>
              <KakaoMap spots={pins} selectedId={cur?.id} onSelect={(p) => p && setStopId(p.id)} />
            </div>
          </Col>
        </Row>
      )}
    </>
  )
}

// ── 노선별 버스 실시간 위치 지도 (20초마다 갱신) ─────────────────
function BusPositions() {
  const [no, setNo] = useState('600')
  const [q, setQ] = useState('600')
  const [routeId, setRouteId] = useState(null)
  const tick = useTick(20000)

  const routes = useAsync(() => fetchTransit('routes', { routeNo: q }), [q])
  const rlist = routes.data ?? []
  const cur = rlist.find((r) => r.routeId === routeId) ?? rlist[0]
  const pos = useAsync(() => (cur ? fetchTransit('positions', { routeId: cur.routeId }) : null), [cur?.routeId, tick])
  const buses = pos.data ?? []
  const pins = useMemo(() => buses.map((b) => ({ id: b.vehicle, title: `${b.route}번 · ${b.vehicle}`, lat: b.lat, lng: b.lng, type: 'busstop' })), [buses])

  return (
    <>
      <form className="d-flex gap-2 mb-3" onSubmit={(e) => { e.preventDefault(); setRouteId(null); setQ(no.trim()) }}>
        <input className="form-control" style={{ maxWidth: 220 }} placeholder="노선 번호 (예: 600, 202)" value={no} onChange={(e) => setNo(e.target.value)} />
        <button className="btn btn-primary" type="submit" aria-label="검색"><i className="bi bi-search" /></button>
      </form>
      <Status loading={routes.loading} error={routes.error} empty={!routes.loading && !routes.error && !rlist.length} emptyText="노선을 찾지 못했어요" />
      {rlist.length > 0 && (
        <>
          <div className="d-flex flex-wrap gap-2 mb-3">
            {rlist.map((r) => (
              <button key={r.routeId} type="button" className={`jp-month ${cur?.routeId === r.routeId ? 'on' : ''}`} onClick={() => setRouteId(r.routeId)}>
                {r.no}번 {r.from} → {r.to}
              </button>
            ))}
          </div>
          <Row className="g-3">
            <Col lg={8}>
              <div className="jp-route-map rounded-3 overflow-hidden border" style={{ height: 400 }}><KakaoMap spots={pins} /></div>
            </Col>
            <Col lg={4}>
              <div className="jp-panel">
                <div className="jp-eyebrow">달리는 버스 · 20초마다 갱신</div>
                <h2 className="h5 fw-bold">{cur?.no}번 {buses.length}대</h2>
                <Status loading={pos.loading && !pos.data} error={pos.error} empty={!pos.loading && !pos.error && !buses.length} emptyText="지금 운행 중인 버스가 없어요" compact />
                {buses.map((b) => (
                  <div key={b.vehicle} className="jp-stop">
                    <span className="n"><i className="bi bi-bus-front" style={{ fontSize: 12 }} /></span>
                    <div className="min-w-0"><div className="fw-semibold">{b.vehicle}</div><div className="leg">{b.stopName} 부근 · {b.order}번째 정류장</div></div>
                  </div>
                ))}
                <div className="small text-muted mt-2">위치는 수십 초 간격으로 갱신돼서 실제와 조금 다를 수 있어요.</div>
              </div>
            </Col>
          </Row>
        </>
      )}
    </>
  )
}

// ── 제주공항 국내선 스케줄 (예정 시각) ──────────────────────────
const CITIES = [['', '전체'], ['GMP', '서울/김포'], ['ICN', '서울/인천'], ['PUS', '부산/김해'], ['TAE', '대구'], ['KWJ', '광주'], ['CJJ', '청주']]

function Flights() {
  const [dir, setDir] = useState('arr')
  const [city, setCity] = useState('')
  const data = useAsync(() => fetchTransit('flights', { direction: dir, city }), [dir, city])
  const now = useMemo(nowKst, [data.data])
  const flights = data.data?.flights ?? []
  const nextIdx = flights.findIndex((f) => f.time >= now)

  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
        <div className="btn-group">
          <button type="button" className={`btn btn-sm ${dir === 'arr' ? 'btn-primary' : 'btn-outline-sea'}`} onClick={() => setDir('arr')}><i className="bi bi-airplane-engines me-1" />제주 도착</button>
          <button type="button" className={`btn btn-sm ${dir === 'dep' ? 'btn-primary' : 'btn-outline-sea'}`} onClick={() => setDir('dep')}><i className="bi bi-airplane me-1" />제주 출발</button>
        </div>
        <select className="form-select" style={{ maxWidth: 180 }} value={city} onChange={(e) => setCity(e.target.value)} aria-label="상대 공항">
          {CITIES.map(([c, l]) => <option key={c} value={c}>{dir === 'arr' ? '출발지 ' : '도착지 '}{l}</option>)}
        </select>
        <span className="small text-muted">오늘 {flights.length}편 · 예정 시각 기준이며 지연·결항은 반영되지 않아요</span>
      </div>
      <Status loading={data.loading} error={data.error} empty={!data.loading && !data.error && !flights.length} emptyText="오늘 운항 정보가 없어요" />
      {flights.length > 0 && (
        <div className="table-responsive jp-panel p-0" style={{ maxHeight: 520, overflowY: 'auto' }}>
          <table className="table align-middle mb-0">
            <thead><tr><th>{dir === 'arr' ? '도착' : '출발'}</th><th>편명</th><th>항공사</th><th>구간</th></tr></thead>
            <tbody>{flights.map((f, i) => (
              <tr key={`${f.flight}-${i}`} className={f.time < now ? 'text-muted' : i === nextIdx ? 'table-active fw-semibold' : ''}>
                <td>{f.time}{i === nextIdx && <span className="badge text-bg-dark ms-2">다음 편</span>}</td>
                <td>{f.flight}</td><td>{f.airline}</td>
                <td>{f.from} {f.dep} → {f.to} {f.arr}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <div className="mt-3"><Link className="btn btn-sm btn-primary" to={`/agent?q=${encodeURIComponent('제주공항에 도착해서 숙소까지 대중교통으로 가는 방법과 첫 코스를 알려줘')}`}><i className="bi bi-stars me-1" />AI에게 공항에서 이동 물어보기</Link></div>
    </>
  )
}

const SUBS = [
  { id: 'arrivals', label: '정류소·도착 정보', icon: 'bus-front' },
  { id: 'positions', label: '노선 버스 위치', icon: 'geo-alt' },
]

// 대중교통 탭: 제주는 버스 중심이라 정류소 검색·도착 정보·노선 버스 위치를 한 곳에 둔다
export function BusTransit() {
  const [sub, setSub] = useState('arrivals')
  return (
    <>
      <div className="btn-group mb-3" role="group" aria-label="대중교통 보기">
        {SUBS.map((s) => (
          <button key={s.id} type="button" className={`btn btn-sm ${sub === s.id ? 'btn-primary' : 'btn-outline-sea'}`} onClick={() => setSub(s.id)}>
            <i className={`bi bi-${s.icon} me-1`} />{s.label}
          </button>
        ))}
      </div>
      {sub === 'arrivals' && <BusArrivals />}
      {sub === 'positions' && <BusPositions />}
    </>
  )
}

// 공항 탭: 제주공항 국내선 운항 스케줄
export function AirportTab() {
  return <Flights />
}

// 선박 탭: 항구별 오늘 여객선 운항 시간표
const FERRY_PORTS = [
  ['제주항', '추자도·완도·진도·목포'], ['운진항', '가파도·마라도'], ['송악산', '마라도'],
  ['추자도', '제주·완도·진도'], ['가파도', '운진항'], ['마라도', '송악산·운진항'], ['제주국제', '삼천포·목포'],
]

export function FerryTab() {
  const [port, setPort] = useState('운진항')
  const { data, loading, error } = useAsync(() => fetchTransit('ferries', { port }), [port])
  const now = new Date(Date.now() + 9 * 3600e3).toISOString().slice(11, 16)
  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-2">
        {FERRY_PORTS.map(([p, to]) => (
          <button key={p} type="button" className={`jp-month ${port === p ? 'on' : ''}`} onClick={() => setPort(p)} title={`${to}행`}>{p}</button>
        ))}
      </div>
      <p className="small text-muted">
        출발 항구를 고르면 오늘 운항 예정 시간표가 나와요{data?.note ? ` (${data.note})` : ''}. 예정 시각이라 기상에 따라 결항될 수 있어요.
        우도·비양도 도항선은 이 공공데이터에 없어요. 성산항·종달항·한림항에서 확인하세요.
      </p>
      <Status loading={loading} error={error} empty={!loading && !error && !data?.sailings?.length} emptyText="오늘 이 항구에서 출발하는 배 정보가 없어요" />
      {data?.sailings?.length > 0 && (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead><tr><th>출발</th><th>도착</th><th>구간</th><th>선박</th><th className="text-end">요금</th></tr></thead>
            <tbody>
              {data.sailings.map((s, i) => (
                <tr key={`${s.dep}-${s.to}-${i}`} className={s.dep < now ? 'text-muted' : ''}>
                  <td className="fw-semibold">{s.dep}</td><td>{s.arr}</td><td>{s.from} → {s.to}</td><td>{s.ship}</td>
                  <td className="text-end">{s.fare ? `${s.fare.toLocaleString()}원` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
