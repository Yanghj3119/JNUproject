import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Container } from 'react-bootstrap'
import { makeAlbumCaptions } from '../api/client'
import { ALBUM_TEMPLATES, shrinkImage, downloadAlbumPptx, recommendTemplate, templateForMood, templateOf, readPhotoMeta, checkPhotoQuality } from '../lib/albumTools'
import { reverseRegion } from '../lib/kakaoGeo'
import { makeAlbumVideo, saveBlob, canMakeVideo } from '../lib/albumVideo'
import { renderAlbumPages } from '../lib/albumRender'
import { useAppStore } from '../store/useAppStore'
import PageBanner from '../components/PageBanner'
import PhotoEditor from '../components/PhotoEditor'
import { DEFAULT_EDIT } from '../lib/photoEdit'

const MAX = 5
const SAMPLES = ['jeju-beach', 'jeju-canola', 'jeju-lighthouse', 'jeju-haenyeo', 'jeju-night'] // public/images 의 제주 풍경 사진 (Pixabay 무료 이미지)
const SLIDE_MS = 1500 // 한 장면에 머무는 시간 (1~2초)
const IDLE_MS = 15 * 60e3 // 15분 동안 아무것도 안 하면 사진과 슬라이드를 지운다

// 슬라이드쇼 미리보기 — 템플릿대로 그려 둔 페이지(PPT 와 같은 그림)를 한 장씩 보여 준다
function Slideshow({ pages, rendering }) {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const box = useRef(null)
  const n = pages.length

  useEffect(() => { if (i >= n) setI(0) }, [n, i])
  useEffect(() => {
    if (!playing || !n) return undefined
    const t = setInterval(() => setI((x) => (x + 1) % n), SLIDE_MS)
    return () => clearInterval(t)
  }, [playing, n])

  const fullscreen = () => { try { box.current?.requestFullscreen?.() } catch { /* 전체 화면을 못 쓰는 환경 */ } }

  return (
    <div>
      <div ref={box} className="jp-slide" role="img" aria-label="미니앨범 미리보기">
        {pages[Math.min(i, n - 1)] && <img key={i} src={pages[Math.min(i, n - 1)].dataUrl} alt="" className="jp-slide-img" />}
        {rendering && <div className="jp-slide-wait"><span className="spinner-border spinner-border-sm me-2" />디자인을 입히는 중…</div>}
        {n > 0 && <div className="jp-slide-count">{Math.min(i, n - 1) + 1} / {n}</div>}
      </div>
      <div className="d-flex flex-wrap gap-2 mt-2">
        <button type="button" className="btn btn-sm btn-outline-sea" onClick={() => setI((x) => (x - 1 + n) % n)} disabled={!n}><i className="bi bi-chevron-left" /> 이전</button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => setPlaying((p) => !p)} disabled={!n}><i className={`bi bi-${playing ? 'pause' : 'play'}-fill me-1`} />{playing ? '멈춤' : '자동 재생'}</button>
        <button type="button" className="btn btn-sm btn-outline-sea" onClick={() => setI((x) => (x + 1) % n)} disabled={!n}>다음 <i className="bi bi-chevron-right" /></button>
        <button type="button" className="btn btn-sm btn-outline-sea ms-auto" onClick={fullscreen}><i className="bi bi-arrows-fullscreen me-1" />전체 화면</button>
      </div>
    </div>
  )
}

export default function Album() {
  const user = useAppStore((s) => s.user)
  const [items, setItems] = useState([]) // [{ id, name, dataUrl, thumb, width, height, caption, ok, note }]
  const [title, setTitle] = useState('제주 미니앨범')
  const [subtitle, setSubtitle] = useState('')
  const [busy, setBusy] = useState('') // '' | 'load' | 'ai' | 'pptx'
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [downloaded, setDownloaded] = useState(false)
  const [tpl, setTpl] = useState('polaroid') // 미니앨범 디자인(템플릿)
  const [pages, setPages] = useState([]) // 템플릿대로 그린 페이지 그림들
  const [rendering, setRendering] = useState(false)
  const [tplManual, setTplManual] = useState(false) // 사용자가 직접 골랐으면 자동 추천이 덮어쓰지 않는다
  const [tone, setTone] = useState('emotional') // AI 문구 어조
  const [orderSuggest, setOrderSuggest] = useState(null) // AI 가 추천한 사진 순서
  const idle = useRef(null)

  // 모두 삭제 — 사진·문구·슬라이드는 이 화면의 메모리에만 있어서 상태를 비우면 끝난다
  const wipe = useCallback((why = '') => {
    setItems([])
    setTitle('제주 미니앨범')
    setSubtitle('')
    setDownloaded(false)
    setTpl('polaroid')
    setPages([])
    setTplManual(false)
    setOrderSuggest(null)
    setErr('')
    setMsg(why)
  }, [])

  // 15분 동안 가만히 있으면 자동 삭제, 사진이 있는 채로 창을 닫으면 경고
  const touch = useCallback(() => {
    clearTimeout(idle.current)
    idle.current = setTimeout(() => wipe('오래 사용하지 않아 사진과 슬라이드를 모두 삭제했어요.'), IDLE_MS)
  }, [wipe])
  useEffect(() => { touch(); return () => clearTimeout(idle.current) }, [touch, items, title, subtitle])
  useEffect(() => {
    if (!items.length || downloaded) return undefined
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [items.length, downloaded])

  // 내 사진이 없어도 써 볼 수 있게, 앱에 들어 있는 제주 풍경 사진으로 바로 시작한다 (직접 올린 사진처럼 같은 과정을 거친다)
  const loadSamples = async () => {
    setErr(''); setMsg('')
    setBusy('load')
    try {
      const files = []
      for (const n of SAMPLES.slice(0, MAX - items.length)) {
        const blob = await (await fetch(`/images/${n}.jpg`)).blob()
        files.push(new File([blob], `${n}.jpg`, { type: 'image/jpeg' }))
      }
      if (!files.length) return setErr(`사진은 최대 ${MAX}장까지예요.`)
      setBusy('')
      await addFiles(files)
      setMsg('샘플 제주 풍경 사진을 담았어요. 사진을 다듬거나 AI 문구를 만들고, 앨범과 영상으로 내려받아 보세요.')
    } catch { setErr('샘플 사진을 불러오지 못했어요') } finally { setBusy('') }
  }

  const addFiles = async (files) => {
    setErr(''); setMsg('')
    const room = MAX - items.length
    const list = [...files].filter((f) => f.type.startsWith('image/')).slice(0, room)
    if (!list.length) return setErr(room <= 0 ? `사진은 최대 ${MAX}장까지예요.` : '사진 파일을 골라 주세요.')
    if ([...files].length > room) setMsg(`최대 ${MAX}장이라 ${list.length}장만 담았어요.`)
    setBusy('load')
    try {
      const added = []
      for (const f of list) {
        if (f.size > 15 * 1024 * 1024) throw new Error(`"${f.name}" 이(가) 너무 커요 (15MB 이하)`)
        const full = await shrinkImage(f, 1600, 0.82)
        const small = await shrinkImage(f, 1024, 0.72) // AI 에 보낼 작은 사진
        // 사진 파일에서 촬영 날짜·위치를 읽는다 (브라우저 안에서만 쓰고, 장소는 읍·면·동 수준까지만 보여 준다)
        const meta = await readPhotoMeta(f)
        const place = meta.lat != null ? ((await reverseRegion(meta.lat, meta.lng)) || '') : ''
        const warn = await checkPhotoQuality(full.dataUrl)
        added.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: f.name, ...full, small: small.dataUrl, origFull: full.dataUrl, edit: DEFAULT_EDIT, rev: 0, caption: '', ok: true, note: '', date: meta.date, place, warn })
      }
      setItems((cur) => [...cur, ...added])
      setDownloaded(false)
    } catch (e) { setErr(e.message) } finally { setBusy('') }
  }

  // 사진이 바뀌면 색을 분석해 템플릿을 자동 추천 (직접 고른 뒤에는 건드리지 않는다)
  const photoKey = items.map((x) => x.id).join(',')
  useEffect(() => {
    if (!items.length || tplManual) return undefined
    let alive = true
    recommendTemplate(items.map((x) => x.small)).then((t) => { if (alive) setTpl(t) })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoKey, tplManual])

  // 사진·문구·제목·디자인이 바뀌면 페이지를 다시 그린다 (입력 중에는 잠깐 기다렸다가)
  const renderKey = JSON.stringify([items.map((x) => [x.id, x.rev, x.caption, x.place, x.date]), title, subtitle, tpl])
  useEffect(() => {
    if (!items.length) { setPages([]); return undefined }
    let alive = true
    setRendering(true)
    const t = setTimeout(() => {
      renderAlbumPages({ template: templateOf(tpl), title, subtitle, items })
        .then((p) => { if (alive) setPages(p) })
        .catch(() => { if (alive) setErr('앨범 그림을 그리지 못했어요. 사진을 다시 골라 보세요.') })
        .finally(() => { if (alive) setRendering(false) })
    }, 350)
    return () => { alive = false; clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderKey])

  const move = (idx, d) => setItems((cur) => { const a = [...cur]; const j = idx + d; if (j < 0 || j >= a.length) return a; [a[idx], a[j]] = [a[j], a[idx]]; return a })
  const remove = (id) => setItems((cur) => cur.filter((x) => x.id !== id))
  const setCaption = (id, caption) => setItems((cur) => cur.map((x) => (x.id === id ? { ...x, caption } : x)))
  const patchItem = useCallback((id, patch) => setItems((cur) => cur.map((x) => (x.id === id ? { ...x, ...patch } : x))), [])
  const setField = (id, key, value) => setItems((cur) => cur.map((x) => (x.id === id ? { ...x, [key]: value } : x)))
  const applyOrder = () => { if (orderSuggest) setItems((cur) => orderSuggest.map((i) => cur[i]).filter(Boolean)); setOrderSuggest(null) }

  const askAi = async () => {
    setErr(''); setMsg('')
    setBusy('ai')
    try {
      const r = await makeAlbumCaptions(items.map((x) => x.small), { tone, hints: items.map((x) => ({ place: x.place, date: x.date })) })
      setTitle(r.title || title)
      setSubtitle(r.subtitle || '')
      if (r.template && !tplManual) setTpl(templateForMood(r.template))
      setItems((cur) => cur.map((x, i) => ({ ...x, caption: r.captions?.[i] || x.caption, ok: r.photoSpotOk?.[i] !== false, note: r.notes?.[i] || '' })))
      const changed = r.order && r.order.some((v, i) => v !== i)
      setOrderSuggest(changed ? r.order : null)
      setMsg(`AI가 제목과 문구를 만들었어요. 마음에 안 들면 어조를 바꿔 다시 만들거나 직접 고칠 수 있어요.`)
    } catch (e) { setErr(`${e.message} — 문구는 직접 적어도 앨범을 만들 수 있어요.`) } finally { setBusy('') }
  }

  // 사진 한 장의 문구만 AI에게 맡긴다 (제목·다른 사진 문구는 건드리지 않는다)
  const askOne = async (x) => {
    setErr(''); setMsg('')
    setBusy(`ai:${x.id}`)
    try {
      const r = await makeAlbumCaptions([x.small], { tone, hints: [{ place: x.place, date: x.date }] })
      const c = r.captions?.[0]
      if (!c) throw new Error('문구를 만들지 못했어요')
      setCaption(x.id, c)
    } catch (e) { setErr(`${e.message} — 문구는 직접 적어도 앨범을 만들 수 있어요.`) } finally { setBusy('') }
  }

  const [vprog, setVprog] = useState(0)
  const downloadVideo = async () => {
    setErr(''); setMsg(''); setVprog(0)
    setBusy('video')
    try {
      const blob = await makeAlbumVideo({ pages, onProgress: setVprog })
      saveBlob(blob, `${title.replace(/[\/:*?"<>|]/g, '').trim() || '제주-미니앨범'}.mp4`)
      setDownloaded(true)
      setMsg('영상을 내려받았어요. 휴대폰 갤러리에서 바로 재생할 수 있어요. 이 페이지를 나가면 사진과 슬라이드는 모두 삭제돼요.')
    } catch (e) { setErr(`영상을 만들지 못했어요: ${e.message}`) } finally { setBusy('') }
  }

  const download = async () => {
    setErr(''); setMsg('')
    setBusy('pptx')
    try {
      await downloadAlbumPptx({ title, pages, fileName: `${title.replace(/[\\/:*?"<>|]/g, '').trim() || '제주-미니앨범'}.pptx` })
      setDownloaded(true)
      setMsg('PPT를 내려받았어요. 이 페이지를 나가면 사진과 슬라이드는 모두 삭제돼요.')
    } catch (e) { setErr(`PPT를 만들지 못했어요: ${e.message}`) } finally { setBusy('') }
  }

  return (
    <>
      <PageBanner img="/images/jeju-chairs.jpg" pos="50% 60%" eyebrow="사진 편집" title="AI로 내 사진 다듬기"
        sub="사진 최대 5장을 슬라이더·필터·말로 다듬어 저장하고, 원하면 앨범·영상으로도 만들어요. 사진은 서버에 저장되지 않고, 나가면 모두 삭제돼요." />
      <Container className="pt-4 pb-5 jp-info">
        <div className="alert alert-light border small">
          <i className="bi bi-shield-check me-1 text-jp" />
          사진은 <b>이 브라우저 안에서만</b> 처리돼요. 사진 파일에 든 촬영 날짜와 위치(읍·면·동까지만)는 앨범 페이지에 넣으려고 이 브라우저에서 읽어요. AI 편집·문구를 요청할 때만 요청 문장(과 줄인 사진 한 장)이 AI에게 전달되고, 저장되지 않아요. 얼굴이나 개인정보가 나온 사진은 주의해서 올려 주세요.
        </div>

        {err && <div className="alert alert-warning py-2">{err}</div>}
        {msg && <div className="alert alert-success py-2">{msg}</div>}

        <div className="jp-panel mb-3">
          <div className="jp-eyebrow mb-1">1. 사진 고르기 ({items.length}/{MAX})</div>
          <input type="file" accept="image/*" multiple className="form-control" disabled={busy === 'load' || items.length >= MAX}
            onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} aria-label="사진 고르기" />
          {items.length === 0 && (
            <div className="d-flex flex-wrap align-items-center gap-2 mt-2">
              <button type="button" className="btn btn-sm btn-outline-sea" onClick={loadSamples} disabled={busy !== ''}><i className="bi bi-images me-1" />샘플 사진으로 체험하기</button>
              <span className="small text-muted">내 사진이 없어도 제주 풍경 샘플 5장으로 바로 써 볼 수 있어요</span>
            </div>
          )}
          {busy === 'load' && <div className="small text-muted mt-2"><span className="spinner-border spinner-border-sm me-2" />사진을 줄이는 중…</div>}
          {items.length > 0 && (
            <div className="d-grid gap-2 mt-3">
              {items.map((x, idx) => (
                <div key={x.id} className="d-flex gap-2 align-items-start border rounded-3 p-2 bg-white">
                  <img src={x.dataUrl} alt={x.name} style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 8 }} />
                  <div className="flex-grow-1 min-w-0">
                    <div className="input-group input-group-sm">
                      <input className="form-control" placeholder={`${idx + 1}번 사진 문구 (직접 쓰거나 AI에게 맡기세요)`} value={x.caption} maxLength={60}
                        onChange={(e) => setCaption(x.id, e.target.value)} aria-label={`${idx + 1}번 사진 문구`} />
                      <button type="button" className="btn btn-outline-sea" onClick={() => askOne(x)} disabled={busy !== '' || !user}
                        title={user ? '이 사진의 문구를 AI가 써 줘요 (아래 어조 선택을 따라요)' : '로그인하면 AI 문구를 쓸 수 있어요'}>
                        {busy === `ai:${x.id}` ? <span className="spinner-border spinner-border-sm" /> : <><i className="bi bi-stars me-1" />AI 문구</>}
                      </button>
                    </div>
                    <div className="d-flex flex-wrap gap-2 mt-1">
                      <input className="form-control form-control-sm" style={{ width: 128 }} placeholder="날짜 2026.11.03" value={x.date || ''} maxLength={12} onChange={(e) => setField(x.id, 'date', e.target.value)} aria-label={`${idx + 1}번 사진 날짜`} />
                      <input className="form-control form-control-sm" style={{ width: 200 }} placeholder="장소 (예: 서귀포시 성산읍)" value={x.place || ''} maxLength={20} onChange={(e) => setField(x.id, 'place', e.target.value)} aria-label={`${idx + 1}번 사진 장소`} />
                    </div>
                    {x.warn && <div className="small text-warning-emphasis mt-1"><i className="bi bi-exclamation-triangle me-1" />{x.warn}</div>}
                    {x.note && <div className="small text-muted mt-1"><i className="bi bi-info-circle me-1" />{x.note}</div>}
                  </div>
                  <div className="d-flex flex-column gap-1">
                    <button type="button" className="btn btn-sm btn-outline-sea py-0" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="위로"><i className="bi bi-chevron-up" /></button>
                    <button type="button" className="btn btn-sm btn-outline-sea py-0" onClick={() => move(idx, 1)} disabled={idx === items.length - 1} aria-label="아래로"><i className="bi bi-chevron-down" /></button>
                  </div>
                  <button type="button" className="btn btn-sm btn-outline-sea" onClick={() => remove(x.id)} aria-label="사진 빼기"><i className="bi bi-trash" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <>
            <div className="jp-panel mb-3">
              <div className="jp-eyebrow mb-2">2. 사진 다듬기</div>
              <PhotoEditor items={items} onChange={patchItem} user={user} />
            </div>

            <div className="jp-panel mb-3">
              <div className="jp-eyebrow mb-1">3. 앨범으로 만들기 (선택) · 제목과 문구</div>
              <div className="d-flex flex-wrap gap-2 mb-2">
                <input className="form-control" style={{ maxWidth: 320 }} placeholder="앨범 제목" value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} aria-label="앨범 제목" />
                <input className="form-control" style={{ maxWidth: 420 }} placeholder="부제 (선택)" value={subtitle} maxLength={80} onChange={(e) => setSubtitle(e.target.value)} aria-label="부제" />
              </div>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <select className="form-select" style={{ maxWidth: 170 }} value={tone} onChange={(e) => setTone(e.target.value)} aria-label="문구 어조">
                  <option value="emotional">어조: 감성적</option>
                  <option value="plain">어조: 담백한</option>
                  <option value="witty">어조: 재치 있는</option>
                  <option value="english">어조: 영어</option>
                </select>
                <button type="button" className="btn btn-primary" onClick={askAi} disabled={busy !== '' || !user}>
                  {busy === 'ai' ? <><span className="spinner-border spinner-border-sm me-2" />AI가 사진을 보는 중…</> : <><i className="bi bi-stars me-1" />{items.some((x) => x.caption) ? '문구 다시 만들기' : 'AI로 제목·문구 만들기'}</>}
                </button>
                {!user && <span className="small text-muted"><Link to="/login">로그인</Link>하면 AI 문구를 쓸 수 있어요. 직접 적는 것은 로그인 없이도 돼요.</span>}
              </div>
              {orderSuggest && (
                <div className="alert alert-info py-2 small mt-2 mb-0 d-flex flex-wrap align-items-center gap-2">
                  <span><i className="bi bi-lightbulb me-1" />AI가 이야기 흐름에 맞는 사진 순서를 추천했어요 ({orderSuggest.map((i) => i + 1).join(' → ')}번). 첫 사진이 표지에 어울려요.</span>
                  <button type="button" className="btn btn-sm btn-primary ms-auto" onClick={applyOrder}>추천 순서로 바꾸기</button>
                  <button type="button" className="btn btn-sm btn-outline-sea" onClick={() => setOrderSuggest(null)}>그대로 두기</button>
                </div>
              )}
            </div>

            <div className="jp-panel mb-3">
              <div className="jp-eyebrow mb-2">4. 앨범 미리보기</div>
              <div className="mb-2">
                {['album', 'minimal'].map((g) => (
                  <div key={g} className="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <span className="small fw-semibold" style={{ minWidth: 92 }}><i className={`bi bi-${g === 'album' ? 'journal-richtext' : 'square'} me-1`} />{g === 'album' ? '앨범형' : '미니멀'}</span>
                    {Object.entries(ALBUM_TEMPLATES).filter(([, t]) => t.group === g).map(([id, t]) => (
                      <button key={id} type="button" className={`jp-month ${tpl === id ? 'on' : ''}`} onClick={() => { setTpl(id); setTplManual(true) }} title={t.desc}>
                        <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: t.swatch, border: '1px solid rgba(0,0,0,0.25)', marginRight: 6, verticalAlign: '-1px' }} />{t.label}
                      </button>
                    ))}
                  </div>
                ))}
                <div className="small text-muted">{tplManual ? '직접 고른 디자인이에요' : '사진 색에 맞춰 자동으로 추천했어요'} · {ALBUM_TEMPLATES[tpl]?.desc} · 자동 재생은 장당 1.5초 · 세로 사진 두 장은 한 페이지에 나란히 넣어요</div>
              </div>
              <Slideshow pages={pages} rendering={rendering} />
            </div>

            <div className="jp-panel">
              <div className="jp-eyebrow mb-2">5. 앨범·영상 내려받기 또는 삭제</div>
              <div className="d-flex flex-wrap gap-2">
                <button type="button" className="btn btn-outline-sea" onClick={download} disabled={busy !== '' || rendering || !pages.length}>
                  {busy === 'pptx' ? <><span className="spinner-border spinner-border-sm me-2" />PPT 만드는 중…</> : <><i className="bi bi-download me-1" />PPT로 내려받기 (.pptx)</>}
                </button>
                {canMakeVideo() && (
                  <button type="button" className="btn btn-primary" onClick={downloadVideo} disabled={busy !== '' || rendering || !pages.length}>
                    {busy === 'video' ? <><span className="spinner-border spinner-border-sm me-2" />영상 만드는 중… {Math.round(vprog * 100)}%</> : <><i className="bi bi-film me-1" />영상으로 저장 (.mp4)</>}
                  </button>
                )}
                <button type="button" className="btn btn-outline-sea" onClick={() => wipe('사진과 슬라이드를 모두 삭제했어요.')} disabled={busy !== ''}><i className="bi bi-trash me-1" />모두 삭제</button>
              </div>
              <div className="small text-muted mt-2">
                영상(.mp4)은 휴대폰 갤러리에서 바로 재생돼요(약 2초씩 부드럽게 넘어가요). PPT에는 장당 1.5초 자동 넘김과 페이드 전환이 들어 있어서, 슬라이드쇼를 시작하면 앨범처럼 저절로 넘어가요.<br />
                {downloaded ? '내려받았어요. 이 페이지를 나가거나 15분이 지나면 사진과 슬라이드는 삭제돼요.' : '내려받지 않고 이 페이지를 나가거나 15분이 지나면 사진과 슬라이드는 자동으로 삭제돼요.'}
              </div>
            </div>
          </>
        )}
      </Container>
    </>
  )
}
