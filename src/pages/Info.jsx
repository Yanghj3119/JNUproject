import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Col, Container, Row } from 'react-bootstrap'
import { fetchHub } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { TRAIL_POINTS } from '../data/trailPoints'
import { findLodgingInfo, findPlace, mapSearchLink, mapToLink, mapWalkLink } from '../lib/kakaoGeo'
import { roadRoute } from '../lib/routing'
import KakaoMap from '../components/KakaoMap'
import Jeju3D from '../components/Jeju3D'
import PageBanner from '../components/PageBanner'
import { BusTransit, AirportTab, FerryTab } from '../components/TransitTab'
import Status from '../components/Status'

// 여행 정보: 대중교통(버스) · 공항 · 선박 · 렌터카 · 올레길·한라산 둘레길 · 숙박 (둘레길·숙박은 제주데이터허브, 버스·공항은 공공데이터포털)
// 좌표가 없는 데이터(둘레길·숙박)는 카카오 장소·주소 검색으로 위치를 찾아 지도에 표시한다.
const TABS = [
  { id: 'bus', label: '대중교통', icon: 'bus-front' },
  { id: 'airport', label: '공항', icon: 'airplane' },
  { id: 'ferry', label: '선박', icon: 'water' },
  { id: 'rent', label: '렌터카', icon: 'car-front' },
  { id: 'trail', label: '올레길·둘레길', icon: 'signpost-2' },
  { id: 'lodging', label: '숙박', icon: 'building' },
]

const LODGING_TYPES = ['가족호텔업', '관광호텔업', '소형호텔업', '의료관광호텔업', '호스텔업', '휴양콘도미니엄업']

const Select = ({ value, onChange, options, all = '전체', label }) => (
  <select className="form-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} style={{ maxWidth: 220 }}>
    <option value="">{all}</option>
    {options.map((o) => <option key={o} value={o}>{o}</option>)}
  </select>
)

// 3D 지도에서 코스를 구분하는 선 색 (밝은 위성사진 위에서도 잘 보이는 진한 색)
const TRAIL_COLORS = ['#ff3b30', '#ff9500', '#ffd60a', '#34c759', '#00c7be', '#0a84ff', '#bf5af2', '#ff2d92']

const askLink = (text) => `/agent?q=${encodeURIComponent(text)}`

// ── 한라산 둘레길 ─────────────────────────────────────────────
function TrailTab() {
  const { data, loading, error } = useAsync(() => fetchHub('trail'), [])
  const [selName, setSelName] = useState(null)
  const list = useMemo(() => (data ?? []).filter((t) => t.course), [data])
  const cur = list.find((t) => t.course === selName) ?? list[0] ?? null // 처음엔 첫 코스를 보여 준다

  // 시점·종점 이름 → 카카오 장소 검색으로 좌표
  // 시점·종점은 미리 정리해 둔 좌표가 있으면 그것을, 없으면 카카오 장소 검색을 쓴다
  const locate = (name) => (TRAIL_POINTS[name] ? Promise.resolve(TRAIL_POINTS[name]) : findPlace(name))
  const pts = useAsync(() => (cur ? Promise.all([locate(cur.start), locate(cur.end)]) : null), [cur?.course])
  const [road, setRoad] = useState(null)
  const [view, setView] = useState('3d') // '3d' | 'map'
  const [a, b] = pts.data ?? []
  const route = useMemo(() => [a && { lat: a.lat, lng: a.lng, name: cur?.start }, b && { lat: b.lat, lng: b.lng, name: cur?.end }].filter(Boolean), [a, b, cur])

  // 3D 지도용: OpenStreetMap 에 기록된 코스 선(public/data/hallatrail.json) + 기록이 없는 코스는 도보 경로로 대신 그린다
  const geo = useAsync(() => fetch('/data/hallatrail.json').then((r) => (r.ok ? r.json() : {})).catch(() => ({})), [])
  const traces = geo.data ?? {}
  const hasTrace = Boolean(cur && traces[cur.course])
  const walk = useAsync(() => (cur && !hasTrace && geo.data && a && b ? roadRoute([a, b], 'foot') : null), [cur?.course, hasTrace, Boolean(geo.data), a?.lat, b?.lat])
  const lines3d = useMemo(() => {
    const out = list.filter((t) => traces[t.course]).map((t) => ({
      id: t.course, color: TRAIL_COLORS[list.indexOf(t) % TRAIL_COLORS.length], active: t.course === cur?.course, segments: traces[t.course],
    }))
    if (cur && !hasTrace && a && b) {
      const seg = walk.data?.path ? walk.data.path.map((p) => [p.lat, p.lng]) : [[a.lat, a.lng], [b.lat, b.lng]]
      out.push({ id: cur.course, color: TRAIL_COLORS[list.indexOf(cur) % TRAIL_COLORS.length], active: true, segments: [seg] })
    }
    return out
  }, [list, traces, cur, hasTrace, a, b, walk.data])
  const legend = useMemo(() => lines3d.map((l) => ({ course: l.id, color: l.color })), [lines3d])
  const pins3d = useMemo(() => [a && { id: 'start', title: `시점 · ${cur?.start}`, lat: a.lat, lng: a.lng, type: 'trail' }, b && { id: 'end', title: `종점 · ${cur?.end}`, lat: b.lat, lng: b.lng, type: 'trail' }].filter(Boolean), [a, b, cur])
  const focus = useMemo(() => {
    const act = lines3d.find((l) => l.active)
    const all = act ? act.segments.flat() : []
    if (all.length) return { lat: all.reduce((s, p) => s + p[0], 0) / all.length, lng: all.reduce((s, p) => s + p[1], 0) / all.length }
    return a && b ? { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 } : null
  }, [lines3d, a, b])

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
                <div className="btn-group btn-group-sm mb-2" role="group" aria-label="지도 보기 방식">
                  <button type="button" className={`btn ${view === '3d' ? 'btn-primary' : 'btn-outline-sea'}`} onClick={() => setView('3d')}><i className="bi bi-badge-3d me-1" />3D 지도</button>
                  <button type="button" className={`btn ${view === 'map' ? 'btn-primary' : 'btn-outline-sea'}`} onClick={() => setView('map')}><i className="bi bi-map me-1" />평면 지도</button>
                </div>
                {view === '3d' ? (
                  <div className="jp-map" style={{ height: 460, minHeight: 0 }}>
                    <Jeju3D spots={pins3d} lines={lines3d} focus={focus} exaggeration={3} />
                    <div className="jp-map-hint"><i className="bi bi-mouse me-1" />드래그: 회전 · 휠: 확대 · 굵은 선이 선택한 코스</div>
                  </div>
                ) : (
                  <div className="jp-route-map rounded-3 overflow-hidden border" style={{ height: 460 }}>
                    {route.length ? <KakaoMap route={route} profile="foot" onRoad={setRoad} locate /> : (
                      <div className="h-100 d-grid text-muted text-center p-4" style={{ placeItems: 'center' }}>
                        {pts.loading ? '위치를 찾는 중…' : '시점·종점 위치를 지도에서 찾지 못했어요. 오른쪽 버튼으로 카카오맵에서 직접 검색해 보세요.'}
                      </div>
                    )}
                  </div>
                )}
                {view === '3d' && (
                  <div className="d-flex flex-wrap gap-2 mt-2 small">
                    {legend.map((l) => (
                      <button key={l.course} type="button" className="btn btn-sm btn-link p-0 text-decoration-none text-body" onClick={() => setSelName(l.course)}>
                        <span style={{ display: 'inline-block', width: 18, height: 4, background: l.color, borderRadius: 2, verticalAlign: 'middle', marginRight: 5 }} />{l.course}
                      </button>
                    ))}
                  </div>
                )}
                {route.length > 1 && (
                  <div className="small text-muted mt-2">
                    {view === '3d'
                      ? (hasTrace
                        ? `선은 OpenStreetMap에 기록된 실제 탐방로예요. 시점·종점 핀은 ${a?.addr?.includes('대략') || b?.addr?.includes('대략') ? '대략적인 ' : ''}위치입니다. 탐방 전에 공식 안내를 확인하세요.`
                        : (walk.data ? `이 코스는 기록된 탐방로가 없어 시점에서 종점까지 걷는 길(OpenStreetMap 기준, 도보 약 ${walk.data.km}km)로 그렸어요. 실제 탐방로(${cur.km ?? '-'}km)와 다를 수 있어요.` : '이 코스의 탐방로 선이 없어 시점과 종점만 표시해요. 경로를 불러오는 중이거나 불러오지 못했어요.'))
                      : (road
                        ? `지도의 선은 시점에서 종점까지 걷는 길(OpenStreetMap 기준)이에요. 도보 약 ${road.km}km · ${road.min >= 60 ? `${Math.floor(road.min / 60)}시간 ` : ''}${road.min % 60}분 안내값이라 실제 탐방로(${cur.km ?? '-'}km)와 다를 수 있어요. 탐방 전에 공식 안내를 확인하세요.`
                        : '경로를 불러오는 중이에요. 불러오지 못하면 점선(직선)으로 보여요. 실제 탐방로는 카카오맵 도보 길찾기로 확인하세요.')}
                  </div>
                )}
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

// ── 렌터카·쏘카존 (제주데이터허브, 좌표 포함) ───────────────────
const AIRPORT = { lat: 33.5113, lng: 126.493 }
const kmBetween = (a, b) => {
  const d = Math.PI / 180
  return Math.hypot((b.lng - a.lng) * d * Math.cos(((a.lat + b.lat) / 2) * d), (b.lat - a.lat) * d) * 6371
}
const RENT_KINDS = [
  { id: 'rentcar', label: '렌터카 업체', icon: 'car-front' },
  { id: 'socar', label: '쏘카존 (카셰어링)', icon: 'ev-front' },
]

function RentTab() {
  const [kind, setKind] = useState('rentcar')
  const [area, setArea] = useState('')
  const [name, setName] = useState('')
  const [sort, setSort] = useState('airport')
  const [selId, setSelId] = useState(null)
  const { data, loading, error } = useAsync(() => fetchHub(kind), [kind])

  const list = useMemo(() => {
    const q = name.trim()
    return (data ?? [])
      .filter((p) => (!area || (p.addr ?? '').includes(area)) && (!q || p.title.includes(q)))
      .map((p) => ({ ...p, km: Math.round(kmBetween(AIRPORT, p) * 10) / 10 }))
      .sort((a, b) => (sort === 'airport' ? a.km - b.km : a.title.localeCompare(b.title, 'ko')))
  }, [data, area, name, sort])
  const pins = useMemo(() => list.slice(0, 200).map((p) => ({ id: p.id, title: p.title, lat: p.lat, lng: p.lng, type: kind })), [list, kind])
  const sel = list.find((p) => p.id === selId)

  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-3">
        {RENT_KINDS.map((k) => (
          <button key={k.id} type="button" className={`jp-month ${kind === k.id ? 'on' : ''}`} onClick={() => { setKind(k.id); setSelId(null) }}>
            <i className={`bi bi-${k.icon} me-1`} />{k.label}
          </button>
        ))}
      </div>
      <div className="d-flex flex-wrap gap-2 mb-2">
        <Select value={area} onChange={(v) => { setArea(v); setSelId(null) }} options={['제주시', '서귀포시']} all="지역 전체" label="지역" />
        <select className="form-select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="정렬" style={{ maxWidth: 200 }}>
          <option value="airport">제주공항에서 가까운 순</option>
          <option value="name">이름순</option>
        </select>
        <input className="form-control" placeholder="업체 이름 검색" value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 220 }} aria-label="업체 이름 검색" />
      </div>
      <p className="small text-muted">
        {kind === 'rentcar' ? '제주 렌터카 업체의 위치예요.' : '무인 대여 쏘카존 주차장의 위치예요.'} 요금·보유 차량·예약은 제공되지 않아요. 업체를 누르면 지도에 표시되고, 예약은 카카오맵 페이지의 연락처로 문의하세요. · {list.length}곳
      </p>
      <Status loading={loading} error={error} empty={!loading && !error && !list.length} emptyText="조건에 맞는 곳이 없어요" />
      {list.length > 0 && (
        <Row className="g-3">
          <Col lg={7}>
            <div className="d-grid gap-2" style={{ maxHeight: 520, overflowY: 'auto' }}>
              {list.slice(0, 80).map((p) => (
                <div key={p.id} className={`jp-place jp-place-pick ${p.id === selId ? 'on' : ''}`} style={{ display: 'block' }}>
                  <button type="button" className="jp-place-head" onClick={() => setSelId(p.id)}>
                    <div className="jp-place-img"><i className={`bi bi-${kind === 'socar' ? 'ev-front' : 'car-front'} text-jp`} /></div>
                    <div className="min-w-0 flex-grow-1 text-start">
                      <div className="fw-semibold text-truncate">{p.title}</div>
                      <div className="small text-muted text-truncate">{p.addr}</div>
                      <div className="small mt-1 text-muted"><i className="bi bi-airplane me-1" />제주공항에서 약 {p.km}km</div>
                    </div>
                  </button>
                  {p.id === selId && (
                    <div className="d-flex flex-wrap gap-2 mt-2">
                      <a className="btn btn-sm btn-outline-sea" target="_blank" rel="noreferrer" href={mapToLink(p.title, p.lat, p.lng)}><i className="bi bi-signpost me-1" />길찾기</a>
                      {p.url && <a className="btn btn-sm btn-outline-sea" target="_blank" rel="noreferrer" href={p.url.replace(/^http:/, 'https:')}><i className="bi bi-telephone me-1" />카카오맵 정보·연락처</a>}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {list.length > 80 && <div className="small text-muted mt-2">가까운 순 80곳만 목록에 보여요. 지역이나 이름으로 좁혀 보세요.</div>}
          </Col>
          <Col lg={5}>
            <div className="jp-route-map rounded-3 overflow-hidden border" style={{ height: 520 }}>
              <KakaoMap spots={pins} selectedId={sel?.id ?? null} onSelect={(p) => setSelId(p?.id ?? null)} locate />
            </div>
            <div className="small text-muted mt-2">핀을 누르면 목록에서 해당 업체가 선택돼요. 핀은 최대 200곳까지 표시돼요.</div>
          </Col>
        </Row>
      )}
    </>
  )
}

// ── 숙박: 지도에 전체 숙박시설을 보여 주고, 핀을 누르면 그 숙소의 정보를 보여 준다 ───────────────
// 숙박 목록(제주데이터허브)에는 주소만 있어서, 주소를 좌표로 바꾼 결과를 public/data/lodging.json 에 미리 저장해 두었다 (420곳).
function LodgingDetail({ item, onClose }) {
  // 전화번호·카카오맵 페이지는 시설을 눌렀을 때 카카오 장소 검색에서 찾는다 (숙박 데이터에는 연락처가 없다)
  const info = useAsync(() => findLodgingInfo(item.n, item.a), [item.n, item.a])
  const i = info.data
  const phone = i?.phone?.trim()
  const homepageSearch = `https://www.google.com/search?q=${encodeURIComponent(`${item.n.replace(/\(주\)|\(유\)|주식회사/g, '').trim()} 제주 공식 홈페이지`)}`

  return (
    <div>
      <div className="d-flex justify-content-between align-items-start gap-2">
        <div>
          {item.t && <span className="jp-tag" style={{ '--c': '#0e6f7a' }}>{item.t}</span>}
          <h2 className="h5 fw-bold mt-2 mb-1">{item.n}</h2>
        </div>
        <button type="button" className="btn btn-sm btn-outline-sea" onClick={onClose} aria-label="선택 해제"><i className="bi bi-x-lg" /></button>
      </div>
      <div className="jp-lodge-info mt-2">
        <div><i className="bi bi-telephone me-2" />전화
          {info.loading ? <span className="text-muted ms-2">찾는 중…</span>
            : phone ? <a className="ms-2 fw-semibold" href={`tel:${phone.replace(/[^\d+]/g, '')}`}>{phone}</a>
              : <span className="text-muted ms-2">등록된 번호를 찾지 못했어요</span>}
        </div>
        <div><i className="bi bi-geo-alt me-2" />주소<span className="ms-2">{item.a}</span></div>
        {item.j && <div className="text-muted small ms-4">지번 {item.j}</div>}
        {i?.category && <div><i className="bi bi-tag me-2" />분류<span className="ms-2">{i.category.split('>').slice(-2).map((s) => s.trim()).join(' > ')}</span></div>}
        {item.r != null && <div><i className="bi bi-door-closed me-2" />객실<span className="ms-2">{item.r}개</span></div>}
        {item.s && <div><i className="bi bi-calendar-check me-2" />인허가일<span className="ms-2">{item.s}</span></div>}
        {item.u && <div className="small text-muted ms-4">정보 갱신 {item.u}</div>}
      </div>
      <div className="d-grid gap-2">
        {phone && <a className="btn btn-sm btn-primary" href={`tel:${phone.replace(/[^\d+]/g, '')}`}><i className="bi bi-telephone me-1" />전화 걸기</a>}
        <a className="btn btn-sm btn-outline-sea" target="_blank" rel="noreferrer" href={mapToLink(item.n, item.lat, item.lng)}><i className="bi bi-signpost me-1" />길찾기</a>
        <a className="btn btn-sm btn-outline-sea" target="_blank" rel="noreferrer" href={i?.url ? i.url.replace(/^http:/, 'https:') : mapSearchLink(item.n)}><i className="bi bi-map me-1" />카카오맵 정보·후기</a>
        <a className="btn btn-sm btn-outline-sea" target="_blank" rel="noreferrer" href={homepageSearch}><i className="bi bi-globe me-1" />홈페이지 검색</a>
        <Link className="btn btn-sm btn-primary" to={askLink(`${item.n} 근처에서 가볼 만한 곳과 맛집으로 반나절 코스를 만들어줘`)}><i className="bi bi-stars me-1" />주변 코스 물어보기</Link>
      </div>
    </div>
  )
}

function LodgingTab() {
  const [type, setType] = useState('')
  const [area, setArea] = useState('')
  const [q, setQ] = useState('')
  const [selIdx, setSelIdx] = useState(null)
  const { data, loading, error } = useAsync(() => fetch('/data/lodging.json').then((r) => { if (!r.ok) throw new Error('숙박 목록을 불러오지 못했어요'); return r.json() }), [])

  const all = useMemo(() => (data ?? []).map((p, idx) => ({ ...p, idx })), [data])
  const list = useMemo(() => {
    const k = q.trim().toLowerCase()
    return all.filter((p) => (!type || p.t === type) && (!area || p.a.includes(area)) && (!k || p.n.toLowerCase().includes(k)))
  }, [all, type, area, q])
  const pins = useMemo(() => list.map((p) => ({ id: p.idx, title: p.n, lat: p.lat, lng: p.lng, type: '32' })), [list])
  const sel = selIdx != null ? all[selIdx] : null
  const counts = useMemo(() => {
    const c = {}
    list.forEach((p) => { c[p.t || '기타'] = (c[p.t || '기타'] ?? 0) + 1 })
    return Object.entries(c).sort((a, b) => b[1] - a[1])
  }, [list])

  return (
    <>
      <div className="d-flex flex-wrap gap-2 mb-2">
        <Select value={type} onChange={(v) => { setSelIdx(null); setType(v) }} options={LODGING_TYPES} all="업종 전체" label="업종" />
        <Select value={area} onChange={(v) => { setSelIdx(null); setArea(v) }} options={['제주시', '서귀포시']} all="지역 전체" label="지역" />
        <input className="form-control" placeholder="숙소 이름 검색" value={q} onChange={(e) => { setSelIdx(null); setQ(e.target.value) }} style={{ maxWidth: 240 }} aria-label="숙소 이름 검색" />
      </div>
      <p className="small text-muted">영업 중인 관광 숙박업 {all.length}곳의 위치예요. 핀을 누르면 그 숙소의 정보를 볼 수 있어요. 예약·요금 정보는 제공되지 않아요. · 지금 {list.length}곳 표시</p>
      <Status loading={loading} error={error} empty={!loading && !error && !all.length} emptyText="숙박 정보가 없어요" />
      {all.length > 0 && (
        <Row className="g-3">
          <Col lg={8}>
            <div className="jp-route-map rounded-3 overflow-hidden border" style={{ height: 560 }}>
              <KakaoMap spots={pins} selectedId={sel?.idx ?? null} onSelect={(p) => setSelIdx(p ? p.id : null)} locate />
            </div>
            <div className="small text-muted mt-2">파란 핀이 숙소예요. 핀을 누르면 이름이 보이고 오른쪽에 정보가 나와요.</div>
          </Col>
          <Col lg={4}>
            <div className="jp-panel" style={{ maxHeight: 560, overflowY: 'auto' }}>
              {sel ? <LodgingDetail key={sel.idx} item={sel} onClose={() => setSelIdx(null)} /> : (
                <>
                  <div className="jp-eyebrow mb-1">숙박시설</div>
                  <h2 className="h5 fw-bold mb-2">지도에서 숙소를 골라 보세요</h2>
                  <div className="small text-muted mb-3">{list.length}곳 · 업종별</div>
                  {counts.map(([t, n]) => <div key={t} className="d-flex justify-content-between small py-1 border-top"><span>{t}</span><span className="fw-semibold">{n}곳</span></div>)}
                  {q.trim() && list.length > 0 && (
                    <div className="mt-3">
                      <div className="small fw-semibold mb-1">검색 결과 (누르면 선택)</div>
                      {list.slice(0, 12).map((p) => (
                        <button key={p.idx} type="button" className="jp-listbtn" onClick={() => setSelIdx(p.idx)}>
                          <i className="bi bi-building text-jp me-2" />{p.n}
                        </button>
                      ))}
                      {list.length > 12 && <div className="small text-muted mt-1">외 {list.length - 12}곳은 지도에서 확인하세요</div>}
                    </div>
                  )}
                  {!list.length && <div className="small text-muted mt-3">조건에 맞는 숙소가 없어요</div>}
                </>
              )}
            </div>
          </Col>
        </Row>
      )}
    </>
  )
}

// ── 제주올레길 ───────────────────────────────────────────────
// 두루누비·공공데이터포털에는 제주올레 경로 데이터가 없어서, OpenStreetMap 에 기록된 코스(1~6, 16, 18, 19코스)는 실제 경로선으로 그리고
// 나머지 코스는 시점·종점만 점선으로 이어 보여 준다. 시점·종점 좌표는 카카오 장소 검색 결과를 미리 저장해 두었다 (public/data/olle.json).
const OLLE_SITE = 'https://www.jejuolle.org/'

function OlleTab() {
  const { data, loading, error } = useAsync(() => fetch('/data/olle.json').then((r) => { if (!r.ok) throw new Error('올레길 데이터를 불러오지 못했어요'); return r.json() }), [])
  const list = useMemo(() => data ?? [], [data])
  const [selNo, setSelNo] = useState(null)
  const [view, setView] = useState('3d') // '3d' | 'map'
  const cur = list.find((c) => c.no === selNo) ?? list[0] ?? null

  const lines = useMemo(() => list.map((c, i) => ({
    id: `olle-${c.no}`, color: TRAIL_COLORS[i % TRAIL_COLORS.length], active: c.no === cur?.no, dashed: c.basis !== 'osm', segments: c.segments,
  })), [list, cur])
  const pins = useMemo(() => (cur ? [
    { id: 'start', title: `시점 · ${cur.from}`, lat: cur.a.lat, lng: cur.a.lng, type: 'trail' },
    { id: 'end', title: `종점 · ${cur.to}`, lat: cur.b.lat, lng: cur.b.lng, type: 'trail' },
  ] : []), [cur])
  const focus = useMemo(() => {
    if (!cur) return null
    const all = cur.segments.flat()
    return { lat: all.reduce((s, p) => s + p[0], 0) / all.length, lng: all.reduce((s, p) => s + p[1], 0) / all.length }
  }, [cur])
  const traced = cur?.basis === 'osm'

  return (
    <>
      <Status loading={loading} error={error} empty={!loading && !error && !list.length} emptyText="올레길 정보가 없어요" />
      {list.length > 0 && (
        <>
          <p className="small text-muted">
            코스를 누르면 3D 지도에 시점·종점이 표시돼요. <b>실선</b>은 OpenStreetMap에 기록된 실제 올레길 경로이고, <b>점선</b>은 경로 데이터가 없어 시점과 종점만 이은 선이에요(실제 길이 아니에요).
          </p>
          <Row xs={2} sm={3} lg={6} className="g-2 mb-4">
            {list.map((c, i) => (
              <Col key={c.no}>
                <button type="button" className={`jp-tool jp-pick ${cur?.no === c.no ? 'on' : ''}`} onClick={() => setSelNo(c.no)} style={{ padding: '0.6rem 0.7rem' }}>
                  <div className="d-flex align-items-center gap-2">
                    <span style={{ width: 14, height: 4, background: TRAIL_COLORS[i % TRAIL_COLORS.length], borderRadius: 2, display: 'inline-block', opacity: c.basis === 'osm' ? 1 : 0.5 }} />
                    <span className="fw-semibold">{c.name}</span>
                  </div>
                  <div className="small text-muted mt-1">{c.title}</div>
                  <div className="small">{c.km != null ? `약 ${c.km}km` : <span className="text-muted">거리 정보 없음</span>}</div>
                </button>
              </Col>
            ))}
          </Row>

          {cur && (
            <Row className="g-3">
              <Col lg={8}>
                <div className="btn-group btn-group-sm mb-2" role="group" aria-label="지도 보기 방식">
                  <button type="button" className={`btn ${view === '3d' ? 'btn-primary' : 'btn-outline-sea'}`} onClick={() => setView('3d')}><i className="bi bi-badge-3d me-1" />3D 지도</button>
                  <button type="button" className={`btn ${view === 'map' ? 'btn-primary' : 'btn-outline-sea'}`} onClick={() => setView('map')}><i className="bi bi-map me-1" />평면 지도</button>
                </div>
                {view === '3d' ? (
                  <div className="jp-map" style={{ height: 460, minHeight: 0 }}>
                    <Jeju3D spots={pins} lines={lines} focus={focus} exaggeration={3} />
                    <div className="jp-map-hint"><i className="bi bi-mouse me-1" />드래그: 회전 · 휠: 확대·축소 · 굵은 선이 선택한 코스</div>
                  </div>
                ) : (
                  <div className="jp-route-map rounded-3 overflow-hidden border" style={{ height: 460 }}>
                    <KakaoMap spots={pins} lines={lines} labels locate />
                  </div>
                )}
                <div className="small text-muted mt-2">
                  {traced
                    ? `선택한 ${cur.name}는 OpenStreetMap에 기록된 올레길 경로를 그렸고, 거리는 그 경로를 잰 값(약 ${cur.km}km)이라 공식 안내와 조금 다를 수 있어요.`
                    : `${cur.name}는 경로 데이터가 없어 시점과 종점을 점선으로만 이었어요. 실제 올레길 경로와 거리는 제주올레 공식 안내를 확인하세요.`}
                </div>
              </Col>
              <Col lg={4}>
                <div className="jp-panel">
                  <div className="jp-eyebrow mb-1">선택한 코스</div>
                  <h2 className="h5 fw-bold mb-1">제주올레 {cur.name}</h2>
                  <div className="text-muted mb-3">{cur.title}{cur.km != null ? ` · 약 ${cur.km}km` : ''}</div>
                  <div className="jp-stop"><span className="n">1</span><div><div className="fw-semibold">{cur.from}</div><div className="leg">시점</div></div></div>
                  <div className="jp-stop"><span className="n">2</span><div><div className="fw-semibold">{cur.to}</div><div className="leg">종점</div></div></div>
                  <div className="d-grid gap-2 mt-3">
                    <a className="btn btn-sm btn-outline-sea" target="_blank" rel="noreferrer" href={mapWalkLink({ ...cur.a, name: cur.from }, { ...cur.b, name: cur.to })}><i className="bi bi-person-walking me-1" />카카오맵 도보 길찾기</a>
                    <a className="btn btn-sm btn-outline-sea" target="_blank" rel="noreferrer" href={mapToLink(cur.from, cur.a.lat, cur.a.lng)}><i className="bi bi-signpost me-1" />시점까지 길찾기</a>
                    <a className="btn btn-sm btn-outline-sea" target="_blank" rel="noreferrer" href={OLLE_SITE}><i className="bi bi-box-arrow-up-right me-1" />제주올레 공식 사이트</a>
                    <Link className="btn btn-sm btn-primary" to={askLink(`제주올레 ${cur.name}(${cur.title})를 걷기 좋은 시간대, 날씨, 근처에 같이 갈 곳을 알려줘`)}><i className="bi bi-stars me-1" />AI에게 이 코스 물어보기</Link>
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

// 올레길 · 한라산 둘레길 — 같은 탭에서 하위 메뉴로 나눠 본다
function WalkTab() {
  const [sub, setSub] = useState('olle')
  return (
    <>
      <div className="btn-group mb-3" role="group" aria-label="걷기길 종류">
        <button type="button" className={`btn btn-sm ${sub === 'olle' ? 'btn-primary' : 'btn-outline-sea'}`} onClick={() => setSub('olle')}><i className="bi bi-signpost-2 me-1" />제주올레길</button>
        <button type="button" className={`btn btn-sm ${sub === 'hallasan' ? 'btn-primary' : 'btn-outline-sea'}`} onClick={() => setSub('hallasan')}><i className="bi bi-tree me-1" />한라산 둘레길</button>
      </div>
      {sub === 'olle' ? <OlleTab /> : <TrailTab />}
    </>
  )
}

export default function Info() {
  const [tab, setTab] = useState('bus')
  return (
    <>
      <PageBanner
        img="/images/jeju-stonewall.jpg" pos="50% 70%" eyebrow="여행 정보" title="떠나기 전에 확인하세요"
        sub="버스 도착·위치, 공항·여객선 운항 스케줄, 렌터카 위치, 올레길·한라산 둘레길, 숙박을 공공데이터로 확인하고 지도에서 위치를 볼 수 있어요."
      />
      <Container className="pt-4">
        <div className="jp-tabs" style={{ overflowX: 'auto' }}>
          {TABS.map((t) => (
            <button key={t.id} type="button" className={`jp-tab ${tab === t.id ? 'on' : ''}`} style={{ whiteSpace: 'nowrap' }} onClick={() => setTab(t.id)}>
              <i className={`bi bi-${t.icon} me-1`} />{t.label}
            </button>
          ))}
        </div>

        {tab === 'trail' && <WalkTab />}
        {tab === 'bus' && <BusTransit />}
        {tab === 'airport' && <AirportTab />}
        {tab === 'ferry' && <FerryTab />}
        {tab === 'rent' && <RentTab />}
        {tab === 'lodging' && <LodgingTab />}
      </Container>
    </>
  )
}
