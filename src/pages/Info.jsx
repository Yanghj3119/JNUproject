import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Col, Container, Row } from 'react-bootstrap'
import { fetchHub } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { findAddress, findPlace, mapSearchLink, mapToLink, mapWalkLink } from '../lib/kakaoGeo'
import KakaoMap from '../components/KakaoMap'
import PageBanner from '../components/PageBanner'
import Status from '../components/Status'

// 제주데이터허브 데이터: 한라산 둘레길 · 교통(사고 다발지역·버스 정류소) · 숙박
// 좌표가 없는 데이터(둘레길·숙박)는 카카오 장소·주소 검색으로 위치를 찾아 지도에 표시한다.
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

const askLink = (text) => `/agent?q=${encodeURIComponent(text)}`

// ── 한라산 둘레길 ─────────────────────────────────────────────
function TrailTab() {
  const { data, loading, error } = useAsync(() => fetchHub('trail'), [])
  const [selName, setSelName] = useState(null)
  const list = useMemo(() => (data ?? []).filter((t) => t.course), [data])
  const cur = list.find((t) => t.course === selName) ?? list[0] ?? null // 처음엔 첫 코스를 보여 준다

  // 시점·종점 이름 → 카카오 장소 검색으로 좌표
  const pts = useAsync(() => (cur ? Promise.all([findPlace(cur.start), findPlace(cur.end)]) : null), [cur?.course])
  const [a, b] = pts.data ?? []
  const route = useMemo(() => [a && { lat: a.lat, lng: a.lng, name: cur?.start }, b && { lat: b.lat, lng: b.lng, name: cur?.end }].filter(Boolean), [a, b, cur])

  return (
    <>
      <Status loading={loading} error={error} empty={!loading && !error && !list.length}
        emptyText="받아온 코스가 없어요. 제주데이터허브 프로젝트에 '한라산 둘레길 코스별 정보' API 가 담겨 있는지 확인하세요. (/api/hub?kind=trail&debug=1 로 원본 응답을 볼 수 있어요)" />

      {list.length > 0 && (
        <>
          <p className="small text-muted">코스를 누르면 시점과 종점이 지도에 표시돼요.</p>
          <Row xs={1} sm={2} lg={4} className="g-3 mb-4">
            {list.map((t) => (
              <Col key={t.course}>
                <button type="button" className={`jp-tool jp-pick ${cur?.course === t.course ? 'on' : ''}`} onClick={() => setSelName(t.course)}>
                  <i className="bi bi-tree" />
                  <div className="fw-semibold mt-2">{t.course}</div>
                  {t.km != null && <div className="fs-4 fw-bold lh-1 my-1">{t.km}<span className="fs-6 fw-normal text-muted"> km</span></div>}
                  <div className="small text-muted"><i className="bi bi-geo-alt me-1" />{t.start || '-'} → {t.end || '-'}</div>
                </button>
              </Col>
            ))}
          </Row>

          {cur && (
            <Row className="g-3">
              <Col lg={8}>
                <div className="jp-route-map rounded-3 overflow-hidden border" style={{ height: 380 }}>
                  {route.length ? <KakaoMap route={route} /> : (
                    <div className="h-100 d-grid text-muted text-center p-4" style={{ placeItems: 'center' }}>
                      {pts.loading ? '위치를 찾는 중…' : '시점·종점 위치를 지도에서 찾지 못했어요. 오른쪽 버튼으로 카카오맵에서 직접 검색해 보세요.'}
                    </div>
                  )}
                </div>
                {route.length > 1 && <div className="small text-muted mt-2">지도의 선은 시점과 종점을 잇는 직선이에요. 실제 탐방로는 카카오맵 도보 길찾기로 확인하세요.</div>}
              </Col>
              <Col lg={4}>
                <div className="jp-panel">
                  <div className="jp-eyebrow mb-1">선택한 코스</div>
                  <h2 className="h5 fw-bold mb-1">{cur.course}</h2>
                  {cur.km != null && <div className="text-muted mb-3">총 {cur.km}km</div>}
                  <div className="jp-stop"><span className="n">1</span><div><div className="fw-semibold">{cur.start || '시점 정보 없음'}</div><div className="leg">{a ? a.addr : '위치 확인 중이거나 찾지 못했어요'}</div></div></div>
                  <div className="jp-stop"><span className="n">2</span><div><div className="fw-semibold">{cur.end || '종점 정보 없음'}</div><div className="leg">{b ? b.addr : '위치 확인 중이거나 찾지 못했어요'}</div></div></div>
                  <div className="d-grid gap-2 mt-3">
                    {a && b && <a className="btn btn-sm btn-outline-sea" target="_blank" rel="noreferrer" href={mapWalkLink({ ...a, name: cur.start }, { ...b, name: cur.end })}><i className="bi bi-person-walking me-1" />카카오맵 도보 길찾기</a>}
                    {cur.start && <a className="btn btn-sm btn-outline-sea" target="_blank" rel="noreferrer" href={a ? mapToLink(cur.start, a.lat, a.lng) : mapSearchLink(`제주 ${cur.start}`)}><i className="bi bi-signpost me-1" />시점까지 길찾기</a>}
                    <Link className="btn btn-sm btn-primary" to={askLink(`${cur.course} 둘레길을 걷기 좋은 시간대, 날씨, 근처에 같이 갈 곳을 알려줘`)}><i className="bi bi-stars me-1" />AI에게 이 코스 물어보기</Link>
                  </div>
                </div>
              </Col>
            </Row>
          )}
        </>
      )}
    </>
  )
}

// ── 교통·안전: 사고 다발지역 · 버스 정류소 ─────────────────────
function TrafficTab() {
  const [mode, setMode] = useState('accident') // 'accident' | 'busstop'
  const [sigungu, setSigungu] = useState('')
  const [name, setName] = useState('제주국제공항')
  const [q, setQ] = useState('제주국제공항') // 처음부터 결과가 보이도록 기본 검색어
  const [selId, setSelId] = useState(null)

  const accident = useAsync(() => (mode === 'accident' ? fetchHub('accident', { sigungu }) : null), [mode, sigungu])
  const stops = useAsync(() => (mode === 'busstop' && q ? fetchHub('busstop', { name: q }) : null), [mode, q])
  const cur = mode === 'accident' ? accident : stops

  // 행마다 고유 id 를 붙여 표와 지도 핀을 서로 연결
  const items = useMemo(() => (cur.data ?? []).map((p, i) => ({ ...p, _id: p.id ?? `${mode}-${i}`, _title: p.place ?? p.name })), [cur.data, mode])
  const spots = useMemo(() => items.filter((p) => p.lat > 33 && p.lng > 126).map((p) => ({ id: p._id, title: p._title, lat: p.lat, lng: p.lng, type: mode })), [items, mode])
  const sel = items.find((p) => p._id === selId)

  const reset = (fn) => (v) => { setSelId(null); fn(v) }

  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-3 align-items-center">
        <div className="btn-group">
          <button type="button" className={`btn btn-sm ${mode === 'accident' ? 'btn-primary' : 'btn-outline-sea'}`} onClick={() => reset(setMode)('accident')}>교통사고 다발지역</button>
          <button type="button" className={`btn btn-sm ${mode === 'busstop' ? 'btn-primary' : 'btn-outline-sea'}`} onClick={() => reset(setMode)('busstop')}>버스 정류소</button>
        </div>
        {mode === 'accident'
          ? <Select value={sigungu} onChange={reset(setSigungu)} options={['제주시', '서귀포시']} all="제주 전체" label="시군구" />
          : (
            <form className="d-flex gap-2" onSubmit={(e) => { e.preventDefault(); reset(setQ)(name.trim()) }}>
              <input className="form-control" placeholder="정류소 이름 (예: 제주국제공항, 성산)" value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 260 }} />
              <button className="btn btn-primary" type="submit" aria-label="검색"><i className="bi bi-search" /></button>
            </form>
          )}
      </div>

      {mode === 'accident' && <p className="small text-muted">렌터카로 이동한다면 아래 구간에서는 특히 서행하세요. 발생 건수가 많은 순서예요. 행을 누르면 지도에 표시돼요.</p>}
      {mode === 'busstop' && <p className="small text-muted">도착 시각은 제공되지 않고 위치·방향만 확인할 수 있어요. 행을 누르면 지도에 표시돼요.</p>}

      <Status loading={cur.loading} error={cur.error} empty={!cur.loading && !cur.error && (mode === 'accident' || q) && !items.length} emptyText="결과가 없어요. 이름 일부만 입력해 보세요 (예: 공항)" />
      {items.length > 0 && (
        <Row className="g-3">
          <Col lg={7}>
            <div className="table-responsive jp-panel p-0" style={{ maxHeight: 460, overflowY: 'auto' }}>
              <table className="table table-hover align-middle mb-0 jp-clickable">
                {mode === 'accident' ? (
                  <>
                    <thead><tr><th>지점</th><th className="text-end">발생</th><th className="text-end">사상자</th><th className="text-end">사망</th></tr></thead>
                    <tbody>{items.map((a) => (
                      <tr key={a._id} className={a._id === selId ? 'table-active' : ''} onClick={() => setSelId(a._id)}>
                        <td><div className="fw-semibold">{a.place}</div><div className="small text-muted">{a.area}</div></td><td className="text-end">{a.count}</td><td className="text-end">{a.casualties}</td><td className="text-end">{a.deaths}</td>
                      </tr>
                    ))}</tbody>
                  </>
                ) : (
                  <>
                    <thead><tr><th>정류소</th><th>방향</th><th>주소</th></tr></thead>
                    <tbody>{items.map((s) => (
                      <tr key={s._id} className={s._id === selId ? 'table-active' : ''} onClick={() => setSelId(s._id)}>
                        <td className="fw-semibold">{s.name}<div className="small text-muted">ID {s.id}</div></td><td>{s.direction}</td><td className="small">{s.addr}</td>
                      </tr>
                    ))}</tbody>
                  </>
                )}
              </table>
            </div>
          </Col>
          <Col lg={5}>
            <div className="jp-route-map rounded-3 overflow-hidden border" style={{ height: 380 }}>
              <KakaoMap spots={spots} selectedId={selId} onSelect={(s) => setSelId(s?.id ?? null)} />
            </div>
            {sel && (
              <div className="jp-panel mt-2 py-2">
                <div className="fw-semibold">{sel._title}</div>
                <div className="small text-muted mb-2">{mode === 'accident' ? `${sel.area} · 발생 ${sel.count}건` : sel.addr}</div>
                <a className="btn btn-sm btn-outline-sea" target="_blank" rel="noreferrer" href={mapToLink(sel._title, sel.lat, sel.lng)}><i className="bi bi-signpost me-1" />카카오맵 길찾기</a>
              </div>
            )}
          </Col>
        </Row>
      )}
    </>
  )
}

// ── 숙박: 주소로 위치를 찾아 지도에 표시 ───────────────────────
function LodgingMap({ item }) {
  const { data, loading } = useAsync(async () => (await findAddress(item.addr)) ?? (await findPlace(item.name)), [item.name, item.addr])
  const spots = useMemo(() => (data ? [{ id: 'lodging', title: item.name, lat: data.lat, lng: data.lng, type: '32' }] : []), [data, item.name])

  return (
    <div className="mt-3">
      {data ? (
        <div className="jp-route-map rounded-3 overflow-hidden border" style={{ height: 240 }}><KakaoMap spots={spots} selectedId="lodging" /></div>
      ) : (
        <div className="small text-muted">{loading ? '위치를 찾는 중…' : '지도에서 위치를 찾지 못했어요. 카카오맵에서 직접 검색해 보세요.'}</div>
      )}
      <div className="d-flex flex-wrap gap-2 mt-2">
        {data && <a className="btn btn-sm btn-outline-sea" target="_blank" rel="noreferrer" href={mapToLink(item.name, data.lat, data.lng)}><i className="bi bi-signpost me-1" />길찾기</a>}
        <a className="btn btn-sm btn-outline-sea" target="_blank" rel="noreferrer" href={mapSearchLink(item.name)}><i className="bi bi-map me-1" />카카오맵에서 보기</a>
        <Link className="btn btn-sm btn-primary" to={askLink(`${item.name} 근처에서 가볼 만한 곳과 맛집으로 반나절 코스를 만들어줘`)}><i className="bi bi-stars me-1" />주변 코스 물어보기</Link>
      </div>
    </div>
  )
}

function LodgingTab() {
  const [type, setType] = useState('')
  const [name, setName] = useState('')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(null)
  const { data, loading, error } = useAsync(() => fetchHub('lodging', { type, name: q }), [type, q])

  return (
    <>
      <form className="d-flex flex-wrap gap-2 mb-3" onSubmit={(e) => { e.preventDefault(); setOpen(null); setQ(name.trim()) }}>
        <Select value={type} onChange={(v) => { setOpen(null); setType(v) }} options={LODGING_TYPES} all="업종 전체" label="업종" />
        <input className="form-control" placeholder="숙소 이름 (선택)" value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 240 }} />
        <button className="btn btn-primary" type="submit" aria-label="검색"><i className="bi bi-search" /></button>
      </form>
      <p className="small text-muted">영업 중인 관광 숙박업만 보여요. 숙소를 누르면 지도에서 위치를 볼 수 있어요. 예약·요금 정보는 제공되지 않아요.</p>
      <Status loading={loading} error={error} empty={!loading && !error && !data?.length} emptyText="조건에 맞는 숙소가 없어요" />
      <div className="d-grid gap-2">
        {data?.map((l, i) => {
          const key = `${l.name}-${i}`
          const isOpen = open === key
          return (
            <div key={key} className={`jp-place jp-place-pick ${isOpen ? 'on' : ''}`} style={{ display: 'block' }}>
              <button type="button" className="jp-place-head" onClick={() => setOpen(isOpen ? null : key)} aria-expanded={isOpen}>
                <div className="jp-place-img"><i className="bi bi-building text-jp" /></div>
                <div className="min-w-0 flex-grow-1 text-start">
                  <div className="fw-semibold text-truncate">{l.name}</div>
                  <div className="small text-muted text-truncate">{l.addr}</div>
                  {(l.type || l.rooms != null) && (
                    <div className="small mt-1">
                      {l.type && <span className="jp-tag" style={{ '--c': '#0e6f7a' }}>{l.type}</span>}
                      {l.rooms != null && <span className="ms-2 text-muted">객실 {l.rooms}개</span>}
                    </div>
                  )}
                </div>
                <i className={`bi bi-chevron-${isOpen ? 'up' : 'down'} text-muted`} />
              </button>
              {isOpen && <LodgingMap item={l} />}
            </div>
          )
        })}
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
        sub="제주데이터허브 공공데이터로 한라산 둘레길, 교통 안전, 숙박을 확인하고 지도에서 위치를 볼 수 있어요."
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
