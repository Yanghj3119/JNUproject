import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Container } from 'react-bootstrap'
import { isSupabaseReady } from '../lib/supabase'
import { shrinkImage } from '../lib/albumTools'
import { reverseAddress, searchJejuPlaces } from '../lib/kakaoGeo'
import { MAX_PER_USER, addSpot, dataUrlToBlob, listSpots, removeSpot } from '../lib/userSpots'
import { inJejuArea, useMyLocation } from '../lib/useMyLocation'
import { useAppStore } from '../store/useAppStore'
import PageBanner from '../components/PageBanner'

// 내 사진을 포토 스팟에 올리는 화면 (미니앨범과는 별개 기능). 사진은 줄여서 Supabase Storage 에 저장되고, 본인이 언제든 삭제할 수 있다.
export default function SpotUpload() {
  const user = useAppStore((s) => s.user)
  const authReady = useAppStore((s) => s.authReady)
  const [mine, setMine] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const [photo, setPhoto] = useState(null) // { dataUrl, width, height, name }
  const [title, setTitle] = useState('')
  const [caption, setCaption] = useState('')
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [place, setPlace] = useState(null) // { name, lat, lng }
  const [agree, setAgree] = useState(false)
  const loc = useMyLocation()

  const reload = () => listSpots()
    .then((all) => setMine(all.filter((s) => s.user_id === user?.id)))
    .catch((e) => setErr(e.message)).finally(() => setLoading(false))
  useEffect(() => { if (user) reload(); else setLoading(false) }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // "내 위치로"를 누르면 좌표를 실제 주소로 바꿔 저장한다 (나중에 AI가 이 주소를 기준으로 코스를 만들 수 있게)
  useEffect(() => {
    if (!loc.me) return undefined
    let alive = true
    setPlace({ name: '주소를 찾는 중…', lat: loc.me.lat, lng: loc.me.lng })
    reverseAddress(loc.me.lat, loc.me.lng).then((a) => { if (alive) setPlace({ name: a || `제주 (위도 ${loc.me.lat.toFixed(4)}, 경도 ${loc.me.lng.toFixed(4)})`, lat: loc.me.lat, lng: loc.me.lng }) })
    return () => { alive = false }
  }, [loc.me])

  const pick = async (file) => {
    setErr(''); setMsg('')
    if (!file) return
    if (!file.type.startsWith('image/')) return setErr('사진 파일을 골라 주세요.')
    if (file.size > 15 * 1024 * 1024) return setErr('사진이 너무 커요 (15MB 이하).')
    try { setPhoto({ ...(await shrinkImage(file, 1280, 0.8)), name: file.name }) } catch (e) { setErr(e.message) }
  }

  const search = async () => {
    setErr('')
    const r = await searchJejuPlaces(q, 6).catch(() => [])
    setResults(r)
    if (!r.length) setErr('장소를 찾지 못했어요. 이름이나 주소를 조금 더 자세히 써 주세요.')
  }

  const submit = async () => {
    setErr(''); setMsg('')
    if (!photo || !title.trim() || !place || !agree) return setErr('사진, 제목, 위치를 정하고 확인란에 체크해 주세요.')
    if (place.name === '주소를 찾는 중…') return setErr('주소를 찾는 중이에요. 잠시 뒤 다시 눌러 주세요.')
    if (!inJejuArea(place)) return setErr('제주 안의 위치만 올릴 수 있어요.')
    setBusy(true)
    try {
      await addSpot({ userId: user.id, blob: dataUrlToBlob(photo.dataUrl), title: title.trim(), caption: caption.trim(), placeName: place.name, lat: place.lat, lng: place.lng })
      setMsg('포토 스팟에 올렸어요. 포토 스팟 페이지에서 볼 수 있어요.')
      setPhoto(null); setTitle(''); setCaption(''); setPlace(null); setQ(''); setResults([]); setAgree(false)
      await reload()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const del = async (s) => {
    if (!window.confirm('이 사진을 포토 스팟에서 완전히 삭제할까요? (파일도 함께 지워져요)')) return
    setErr(''); setMsg('')
    try { await removeSpot(s); setMsg('삭제했어요. 사진 파일도 함께 지웠어요.'); await reload() } catch (e) { setErr(e.message) }
  }

  if (!isSupabaseReady) return <Container><div className="alert alert-warning mt-4">Supabase 설정이 없어서 사진을 올릴 수 없어요.</div></Container>

  return (
    <>
      <PageBanner img="/images/jeju-canola.jpg" pos="50% 60%" eyebrow="포토 스팟" title="내 사진 올리기"
        sub="내가 찍은 제주 사진을 포토 스팟에 올려요. 올린 사진은 모두에게 보이고, 언제든 직접 삭제할 수 있어요." />
      <Container className="pt-4 pb-5 jp-info">
        {authReady && !user ? (
          <div className="jp-panel text-center py-4">
            <p className="mb-2">사진을 올리려면 로그인이 필요해요.</p>
            <Link to="/login" className="btn btn-primary">로그인 · 회원가입</Link>
          </div>
        ) : (
          <>
            <div className="alert alert-light border small">
              <i className="bi bi-info-circle me-1 text-jp" />
              한 사람당 최대 {MAX_PER_USER}장까지 올릴 수 있어요. <b>얼굴이 크게 나온 사진, 개인정보, 남의 저작물</b>은 올리지 마세요. 사진은 줄여서(긴 변 1280px, 위치 정보 제거) 저장돼요.
              내 사진으로 슬라이드쇼를 만들고 싶다면 <Link to="/album">미니앨범</Link>을 쓰세요(서버에 저장되지 않아요).
            </div>
            {err && <div className="alert alert-warning py-2">{err}</div>}
            {msg && <div className="alert alert-success py-2">{msg}</div>}

            <div className="jp-panel mb-4">
              <div className="jp-eyebrow mb-2">새 사진 올리기 ({mine.length}/{MAX_PER_USER})</div>
              <input type="file" accept="image/*" className="form-control mb-2" onChange={(e) => pick(e.target.files?.[0])} disabled={mine.length >= MAX_PER_USER} aria-label="사진 고르기" />
              {photo && <img src={photo.dataUrl} alt="미리보기" style={{ maxWidth: '100%', maxHeight: 260, borderRadius: 10 }} className="mb-2" />}
              <input className="form-control mb-2" placeholder="제목 (예: 새벽의 광치기해변)" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} aria-label="제목" />
              <textarea className="form-control mb-2" rows={2} placeholder="한 줄 설명 (선택)" value={caption} maxLength={200} onChange={(e) => setCaption(e.target.value)} aria-label="설명" />

              <div className="small fw-semibold mb-1">찍은 곳</div>
              <div className="d-flex flex-wrap gap-2 mb-2">
                <input className="form-control" style={{ maxWidth: 340 }} placeholder="장소·주소 검색 (예: 광치기해변)" value={q} onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search() } }} aria-label="찍은 곳 검색" />
                <button type="button" className="btn btn-primary" onClick={search} disabled={q.trim().length < 2}><i className="bi bi-search me-1" />찾기</button>
                <button type="button" className="btn btn-outline-sea" onClick={loc.locate} disabled={loc.busy}><i className="bi bi-crosshair me-1" />{loc.busy ? '확인 중…' : '내 위치로'}</button>
              </div>
              {loc.msg && <div className="small text-danger mb-2">{loc.msg}</div>}
              {results.length > 0 && (
                <div className="d-grid gap-1 mb-2">
                  {results.map((r, i) => (
                    <button key={i} type="button" className="jp-listbtn" onClick={() => { setPlace({ name: r.title, lat: r.lat, lng: r.lng }); setResults([]) }}>
                      <i className="bi bi-geo-alt text-jp me-2" />{r.title}<span className="small text-muted ms-2">{r.addr}</span>
                    </button>
                  ))}
                </div>
              )}
              {place && <div className="small mb-2"><i className="bi bi-check-circle text-success me-1" />선택한 위치: <b>{place.name}</b></div>}

              <label className="d-flex gap-2 small mb-3" style={{ cursor: 'pointer' }}>
                <input type="checkbox" className="form-check-input mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>내가 직접 찍은 사진이고, 모두에게 공개되어도 괜찮아요. 얼굴이 크게 나오거나 개인정보가 보이는 사진이 아니에요.</span>
              </label>
              <button type="button" className="btn btn-primary" onClick={submit} disabled={busy || !photo || !title.trim() || !place || !agree}>
                {busy ? <><span className="spinner-border spinner-border-sm me-2" />올리는 중…</> : <><i className="bi bi-cloud-arrow-up me-1" />포토 스팟에 올리기</>}
              </button>
            </div>

            <h2 className="h5 fw-bold">내가 올린 사진</h2>
            {loading && <div className="text-muted small">불러오는 중…</div>}
            {!loading && !mine.length && <div className="text-muted small">아직 올린 사진이 없어요.</div>}
            <div className="row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3 mt-1">
              {mine.map((s) => (
                <div className="col" key={s.id}>
                  <div className="jp-photo">
                    <div className="jp-photo-img"><img src={s.url} alt={s.title} loading="lazy" /></div>
                    <div className="jp-photo-body">
                      <div className="fw-semibold text-truncate">{s.title}</div>
                      <div className="small text-muted text-truncate">{s.place_name}</div>
                      <button type="button" className="btn btn-sm btn-outline-sea mt-2" onClick={() => del(s)}><i className="bi bi-trash me-1" />완전히 삭제</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Container>
    </>
  )
}
