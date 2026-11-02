import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Col, Container, Row } from 'react-bootstrap'
import { fetchHub } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { findAddress, findPlace, mapSearchLink, mapToLink, mapWalkLink } from '../lib/kakaoGeo'
import KakaoMap from '../components/KakaoMap'
import PageBanner from '../components/PageBanner'
import { BusTransit, AirportTab, FerryTab } from '../components/TransitTab'
import Status from '../components/Status'

// 여행 정보: 대중교통(버스) · 공항 · 선박 · 한라산 둘레길 · 숙박 (둘레길·숙박은 제주데이터허브, 버스·공항은 공공데이터포털)
// 좌표가 없는 데이터(둘레길·숙박)는 카카오 장소·주소 검색으로 위치를 찾아 지도에 표시한다.
const TABS = [
  { id: 'bus', label: '대중교통', icon: 'bus-front' },
  { id: 'airport', label: '공항', icon: 'airplane' },
  { id: 'ferry', label: '선박', icon: 'water' },
  { id: 'trail', label: '한라산 둘레길', icon: 'tree' },
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
  const [tab, setTab] = useState('bus')
  return (
    <>
      <PageBanner
        img="/images/jeju-stonewall.jpg" pos="50% 70%" eyebrow="여행 정보" title="떠나기 전에 확인하세요"
        sub="버스 도착·위치, 공항·여객선 운항 스케줄, 한라산 둘레길, 숙박을 공공데이터로 확인하고 지도에서 위치를 볼 수 있어요."
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
        {tab === 'bus' && <BusTransit />}
        {tab === 'airport' && <AirportTab />}
        {tab === 'ferry' && <FerryTab />}
        {tab === 'lodging' && <LodgingTab />}
      </Container>
    </>
  )
}
