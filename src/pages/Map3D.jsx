import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Col, Container, Row } from 'react-bootstrap'
import { fetchAccess, fetchNearby, fetchSpots, fetchWeather } from '../api/client'
import { useAppStore } from '../store/useAppStore'
import { matchFavorites } from '../lib/favKey'
import { useAsync } from '../lib/useAsync'
import { TYPE_META, typeMeta, skyIcon } from '../lib/format'
import { fallbackFor } from '../data/landmarks'
import PageBanner from '../components/PageBanner'
import Jeju3D, { WEATHER_REGIONS } from '../components/Jeju3D'
import KakaoMap from '../components/KakaoMap'
import MyLocationButton from '../components/MyLocationButton'
import { useMyLocation } from '../lib/useMyLocation'
import { searchJejuPlaces } from '../lib/kakaoGeo'
import PlaceCard from '../components/PlaceCard'
import Status from '../components/Status'
import WeatherBadge from '../components/WeatherBadge'

const TYPES = ['12', '14', '39', 'oreum', 'museum', 'souvenir'] // 숫자: 한국관광공사 / 문자: 제주데이터허브

// 날씨 미리보기: 실제 날씨 대신 원하는 날씨·시간대를 3D 로 시험해 볼 수 있다 (발표·시연용)
const WX_MODES = [
  { id: 'live', label: '실시간', icon: 'broadcast' },
  { id: 'clear', label: '맑음', icon: 'brightness-high' },
  { id: 'cloud', label: '흐림', icon: 'cloud' },
  { id: 'rain', label: '비', icon: 'cloud-rain' },
  { id: 'snow', label: '눈', icon: 'cloud-snow' },
  { id: 'night', label: '밤', icon: 'moon-stars' },
]
const SIM = {
  clear: { sky: '맑음', rainy: false, rain: '없음', pop: 0, wind: 3 },
  cloud: { sky: '흐림', rainy: false, rain: '없음', pop: 20, wind: 6 },
  rain: { sky: '흐림', rainy: true, rain: '비', pop: 90, wind: 8 },
  snow: { sky: '흐림', rainy: true, rain: '눈', pop: 80, wind: 4 },
}
const PHASE_LABEL = { day: '낮', golden: '황금시간', night: '밤' }

// 지금 시각이 낮·황금시간·밤 중 어디인지 (HUD 표시용, 3D 와 같은 기준)
function phaseNow(sun) {
  const hm = (s) => { const m = String(s ?? '').match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null }
  const k = new Date(Date.now() + 9 * 3600e3)
  const now = k.getUTCHours() * 60 + k.getUTCMinutes()
  const sr = hm(sun?.sunrise) ?? 390, ss = hm(sun?.sunset) ?? 1080
  if (now < sr - 40 || now > ss + 40) return 'night'
  return now > ss - 60 || now < sr + 50 ? 'golden' : 'day'
}

// 지도 검색창: 지금 지도에 올라온 장소 이름 + 카카오 장소·주소 검색(제주 안)을 함께 찾는다
function MapSearch({ spots, onPick }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [remote, setRemote] = useState([])
  const [busy, setBusy] = useState(false)

  const local = useMemo(() => {
    const k = q.trim().toLowerCase()
    return k.length < 1 ? [] : (spots ?? []).filter((s) => String(s.title).toLowerCase().includes(k)).slice(0, 5)
  }, [q, spots])

  // 입력을 멈추고 0.4초 뒤에 카카오 검색 (너무 자주 부르지 않게)
  useEffect(() => {
    const k = q.trim()
    if (k.length < 2) { setRemote([]); setBusy(false); return }
    setBusy(true)
    let alive = true
    const t = setTimeout(() => searchJejuPlaces(k, 6).then((r) => { if (alive) { setRemote(r); setBusy(false) } }).catch(() => alive && setBusy(false)), 400)
    return () => { alive = false; clearTimeout(t) }
  }, [q])

  const pickLocal = (s) => { setOpen(false); setQ(s.title); onPick({ kind: 'local', spot: s }) }
  const pickRemote = (r) => { setOpen(false); setQ(r.title); onPick({ kind: 'remote', place: r }) }
  const first = local[0] ? () => pickLocal(local[0]) : remote[0] ? () => pickRemote(remote[0]) : null

  return (
    <div className="position-relative mb-2" style={{ maxWidth: 520 }}>
      <form className="d-flex gap-2" onSubmit={(e) => { e.preventDefault(); first?.() }}>
        <input className="form-control" placeholder="장소·주소 검색 (예: 성산일출봉, 함덕해수욕장, 제주시 연동)" value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)} aria-label="지도에서 장소 검색" />
        <button className="btn btn-primary" type="submit" aria-label="검색" disabled={!first}><i className="bi bi-search" /></button>
        {q && <button type="button" className="btn btn-outline-sea" aria-label="검색어 지우기" onClick={() => { setQ(''); setOpen(false); onPick({ kind: 'clear' }) }}><i className="bi bi-x-lg" /></button>}
      </form>
      {open && q.trim() && (
        <div className="jp-search-pop">
          {local.length > 0 && <div className="jp-search-head">지금 지도에 있는 장소</div>}
          {local.map((s) => <button key={`l-${s.id}`} type="button" className="jp-listbtn" onClick={() => pickLocal(s)}><i className="bi bi-geo-alt text-jp me-2" />{s.title}</button>)}
          {(remote.length > 0 || busy) && <div className="jp-search-head">{busy ? '검색 중…' : '카카오 장소·주소 검색'}</div>}
          {remote.map((r, i) => (
            <button key={`r-${i}`} type="button" className="jp-listbtn" onClick={() => pickRemote(r)}>
              <i className="bi bi-search text-jp me-2" />{r.title}<span className="small text-muted ms-2">{r.addr}</span>
            </button>
          ))}
          {!busy && !local.length && !remote.length && q.trim().length >= 2 && <div className="small text-muted p-2">검색 결과가 없어요. 이름이나 주소를 조금 더 자세히 입력해 보세요.</div>}
        </div>
      )}
    </div>
  )
}

export default function Map3D() {
  const [type, setType] = useState('12')
  const [sel, setSel] = useState(null)
  // 핀을 눌러 나온 장소를 위시리스트(하트)에 담기
  const faved = useAppStore((st) => Boolean(sel) && matchFavorites(st.favorites, { source: 'place', id: sel.id, title: sel.title }).length > 0)
  const toggleFav = useAppStore((st) => st.toggleFavorite)
  const [found, setFound] = useState(null) // 검색해서 찾은 장소 (핀으로 함께 표시)
  const [view, setView] = useState('3d') // '3d' | 'map'
  const [exag, setExag] = useState(3) // 3D 고도 과장 배율
  const [wx, setWx] = useState('live') // 날씨 미리보기 모드

  // 내 위치: 3D·평면 지도가 함께 쓴다 (한 번 더 누르면 꺼지고 처음 보기로 돌아간다)
  const loc = useMyLocation()
  const mePin = useMemo(() => (loc.me ? [{ id: 'me', title: '내 위치', lat: loc.me.lat, lng: loc.me.lng, type: 'me', label: true }] : []), [loc.me])

  const fetched = useAsync(() => fetchSpots(type), [type])
  // 공공데이터가 비어 있거나 실패하면 대표 명소로 대체해서 핀이 항상 보이게 한다
  const usingFallback = !fetched.loading && !fetched.data?.length && fallbackFor(type).length > 0
  const spots = useMemo(() => ({
    ...fetched,
    data: usingFallback ? fallbackFor(type) : fetched.data,
    error: usingFallback ? null : fetched.error,
  }), [fetched, usingFallback, type])
  const shown = useMemo(() => [...(spots.data ?? []), ...(found ? [found] : [])], [spots.data, found])
  const onSearchPick = (r) => {
    if (r.kind === 'clear') { setFound(null); setSel(null); return }
    if (r.kind === 'local') { setSel(r.spot); return }
    const p = r.place // 카카오 검색 결과 → 임시 핀 + 오른쪽 정보 패널
    const f = { id: 'found', title: p.title, addr: p.addr, lat: p.lat, lng: p.lng, type: 'search', hub: true, url: p.url }
    setFound(f)
    setSel(f)
  }
  const weather = useAsync(() => fetchWeather({ place: '제주시' }), [])
  // 지역별 현재 날씨 (제주시·서귀포시·성산·한림) — 일부가 실패해도 나머지는 표시
  const regions = useAsync(async () => (await Promise.all(WEATHER_REGIONS.map((r) =>
    fetchWeather({ place: r.place }).then((w) => (w?.now ? { ...r, ...w.now } : null)).catch(() => null)))).filter(Boolean), [])

  const live = weather.data?.now
  const sun = weather.data?.sun
  // 미리보기 모드면 실제 값 위에 선택한 날씨를 덮어쓴다 (밤은 날씨는 그대로, 시간대만 밤)
  const effective = live && (wx === 'live' || wx === 'night' ? live : { ...live, ...SIM[wx] })
  const override = wx === 'live' ? null : wx === 'night' ? 'night' : 'day'
  const phase = wx === 'night' ? 'night' : wx === 'live' ? phaseNow(sun) : 'day'
  const showRegions = wx === 'live' || wx === 'night'
  const nearby = useAsync(() => (sel ? fetchNearby({ lat: sel.lat, lng: sel.lng, radius: 2000, exclude: sel.id }) : null), [sel?.id])
  // 무장애 정보는 한국관광공사 장소(contentId)만 조회 가능 — 제주데이터허브 장소(hub)는 건너뜀
  const access = useAsync(() => (sel && !sel.hub ? fetchAccess({ contentId: sel.id }) : null), [sel?.id])

  return (
    <>
      <PageBanner
        img="/images/jeju-lighthouse.jpg" pos="50% 58%" eyebrow="지도" title="제주 지도"
        sub="핀을 눌러 명소의 날씨·주변 명소·무장애 정보를 확인하세요."
      >
        <div className="btn-group" role="group" aria-label="지도 보기 방식">
          <button type="button" className={`btn btn-sm ${view === '3d' ? 'btn-light' : 'btn-outline-light'}`} onClick={() => setView('3d')}><i className="bi bi-badge-3d me-1" />3D</button>
          <button type="button" className={`btn btn-sm ${view === 'map' ? 'btn-light' : 'btn-outline-light'}`} onClick={() => setView('map')}><i className="bi bi-map me-1" />지도</button>
        </div>
      </PageBanner>

    <Container className="pt-3">
      <Row className="g-3">
        <Col lg={8}>
          <MapSearch spots={spots.data} onPick={onSearchPick} />
          <div className="jp-map">
            <div className="jp-map-chips">
              {TYPES.map((t) => (
                <button key={t} type="button" className={`jp-month ${type === t ? 'on' : ''}`} onClick={() => { setType(t); setSel(null); setFound(null) }}>
                  <i className={`bi bi-${TYPE_META[t].icon} me-1`} />{TYPE_META[t].label}
                </button>
              ))}
            </div>
            {view === '3d'
              ? <Jeju3D spots={shown} selectedId={sel?.id} onSelect={setSel} weather={effective} sun={sun} override={override} regional={showRegions ? regions.data ?? [] : []} exaggeration={exag} loc={loc} actionsClass="up" />
              : <KakaoMap spots={[...shown, ...mePin]} selectedId={sel?.id} onSelect={(s) => s?.id !== 'me' && setSel(s)} center={loc.me} />}
            {view === 'map' && <div className="jp-map-actions flat"><MyLocationButton loc={loc} /></div>}
            <div className="jp-map-hint">
              {view === '3d'
                ? <><i className="bi bi-mouse me-1" />드래그: 회전 · 휠: 확대 · 핀: 선택</>
                : <><i className="bi bi-hand-index me-1" />핀을 눌러 선택하세요</>}
            </div>
            {view === '3d' && (
              <>
                {effective && (
                  <div className="jp-map-hud" aria-live="polite">
                    <div className="d-flex align-items-center gap-2">
                      <i className={`bi bi-${wx === 'night' ? 'moon-stars' : skyIcon(effective)} fs-4`} />
                      <div>
                        <div className="fw-bold lh-1">{wx === 'live' || wx === 'night' ? `${effective.temp}°` : '미리보기'} · {effective.rainy ? effective.rain : effective.sky}</div>
                        <div className="small opacity-75">강수 {effective.pop}% · 바람 {effective.wind}m/s · {PHASE_LABEL[phase]}</div>
                      </div>
                    </div>
                    {sun?.sunrise && <div className="small mt-1 opacity-90"><i className="bi bi-sunrise me-1" />{sun.sunrise}<i className="bi bi-sunset ms-2 me-1" />{sun.sunset}</div>}
                  </div>
                )}
                <div className="jp-map-tools jp-map-wx" role="group" aria-label="날씨 미리보기">
                  <span>날씨</span>
                  {WX_MODES.map((m) => (
                    <button key={m.id} type="button" className={wx === m.id ? 'on' : ''} onClick={() => setWx(m.id)} title={m.id === 'live' ? '지금 실제 날씨' : `${m.label} 날씨 미리보기`}>
                      <i className={`bi bi-${m.icon}`} /> {m.label}
                    </button>
                  ))}
                </div>
                <div className="jp-map-tools" role="group" aria-label="고도 과장">
                  <span>고도</span>
                  {[1, 2, 3, 5].map((n) => (
                    <button key={n} type="button" className={exag === n ? 'on' : ''} onClick={() => setExag(n)}>×{n}</button>
                  ))}
                </div>
                <div className="jp-map-attrib">
                  위성영상 © Sentinel-2 cloudless (<a href="https://s2maps.eu" target="_blank" rel="noreferrer">s2maps.eu</a> by EOX IT Services GmbH, Contains modified Copernicus Sentinel data 2020) · 고도 © Mapzen, AWS Terrain Tiles
                </div>
              </>
            )}
          </div>
          {view === 'map' && loc.msg && <div className="alert alert-warning py-2 small mt-2 mb-0">{loc.msg}</div>}
          {usingFallback && (
            <div className="small text-muted mt-2">
              <i className="bi bi-info-circle me-1" />공공데이터를 불러오지 못해 제주 대표 명소를 보여 드려요.
              {fetched.error && <span className="ms-1">({fetched.error})</span>}
            </div>
          )}
          <Status loading={spots.loading} error={spots.error} empty={!spots.loading && !spots.error && !spots.data?.length} emptyText="표시할 장소가 없어요" compact />
          {!spots.loading && spots.data?.length > 0 && <div className="small text-muted mt-2">{spots.data.length}곳을 표시하고 있어요</div>}
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
                <div className="d-flex align-items-start justify-content-between gap-2 mt-2 mb-1">
                  <h2 className="h5 fw-bold mb-0">{sel.title}</h2>
                  <button type="button" className={`btn btn-sm jp-iconbtn fs-4 p-0 ${faved ? 'on' : ''}`} aria-label="위시리스트에 담기" title={faved ? '위시리스트에서 빼기' : '위시리스트에 담기'}
                    onClick={() => toggleFav({ source: 'place', id: sel.id, title: sel.title, image: sel.image })}>
                    <i className={`bi bi-heart${faved ? '-fill' : ''}`} />
                  </button>
                </div>
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
    </>
  )
}
