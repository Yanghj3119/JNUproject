import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Container } from 'react-bootstrap'
import { makeAlbumCaptions } from '../api/client'
import { ALBUM_TEMPLATES, shrinkImage, downloadAlbumPptx, recommendTemplate } from '../lib/albumTools'
import { useAppStore } from '../store/useAppStore'
import PageBanner from '../components/PageBanner'

const MAX = 5
const SLIDE_MS = 1500 // 한 장면에 머무는 시간 (1~2초)
const IDLE_MS = 15 * 60e3 // 15분 동안 아무것도 안 하면 사진과 슬라이드를 지운다

// 슬라이드쇼 미리보기 (표지 + 사진 + 마지막 장)
function Slideshow({ title, subtitle, items, template }) {
  const T = ALBUM_TEMPLATES[template] ?? ALBUM_TEMPLATES.classic
  const vars = { '--tp-bg': `#${T.bg}`, '--tp-bg2': `#${T.bg2}`, '--tp-bar': `#${T.bar}`, '--tp-accent': `#${T.accent}`, '--tp-text': `#${T.text}`, '--tp-sub': `#${T.sub}` }
  const slides = [{ kind: 'title' }, ...items.map((it) => ({ kind: 'photo', ...it })), { kind: 'end' }]
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(false)
  const box = useRef(null)

  useEffect(() => { if (i >= slides.length) setI(0) }, [slides.length, i])
  useEffect(() => {
    if (!playing) return undefined
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), SLIDE_MS)
    return () => clearInterval(t)
  }, [playing, slides.length])

  const s = slides[Math.min(i, slides.length - 1)]
  const bg = s.kind === 'photo' ? s.dataUrl : items[0]?.dataUrl
  const fullscreen = () => { try { box.current?.requestFullscreen?.() } catch { /* 전체 화면을 못 쓰는 환경 */ } }

  return (
    <div>
      <div ref={box} className="jp-slide" style={vars} role="img" aria-label="미니앨범 미리보기">
        {bg && <img key={i} src={bg} alt="" className={`jp-slide-img ${s.kind !== 'photo' ? 'dim' : ''}`} />}
        {s.kind !== 'photo' && <div className="jp-slide-bgfill" />}
        {s.kind === 'title' && <div className="jp-slide-text"><h2>{title}</h2><p>{subtitle}</p><small>제주픽 미니앨범</small></div>}
        {s.kind === 'end' && <div className="jp-slide-text"><h2>감사합니다</h2><small>제주픽으로 만든 미니앨범</small></div>}
        {s.kind === 'photo' && s.caption && <div className="jp-slide-cap">{s.caption}</div>}
        <div className="jp-slide-count">{i + 1} / {slides.length}</div>
      </div>
      <div className="d-flex flex-wrap gap-2 mt-2">
        <button type="button" className="btn btn-sm btn-outline-sea" onClick={() => setI((x) => (x - 1 + slides.length) % slides.length)}><i className="bi bi-chevron-left" /> 이전</button>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => setPlaying((p) => !p)}><i className={`bi bi-${playing ? 'pause' : 'play'}-fill me-1`} />{playing ? '멈춤' : '자동 재생'}</button>
        <button type="button" className="btn btn-sm btn-outline-sea" onClick={() => setI((x) => (x + 1) % slides.length)}>다음 <i className="bi bi-chevron-right" /></button>
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
  const [tpl, setTpl] = useState('classic') // 미니앨범 디자인(템플릿)
  const [tplManual, setTplManual] = useState(false) // 사용자가 직접 골랐으면 자동 추천이 덮어쓰지 않는다
  const idle = useRef(null)

  // 모두 삭제 — 사진·문구·슬라이드는 이 화면의 메모리에만 있어서 상태를 비우면 끝난다
  const wipe = useCallback((why = '') => {
    setItems([])
    setTitle('제주 미니앨범')
    setSubtitle('')
    setDownloaded(false)
    setTpl('classic')
    setTplManual(false)
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
        added.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, name: f.name, ...full, small: small.dataUrl, caption: '', ok: true, note: '' })
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

  const move = (idx, d) => setItems((cur) => { const a = [...cur]; const j = idx + d; if (j < 0 || j >= a.length) return a; [a[idx], a[j]] = [a[j], a[idx]]; return a })
  const remove = (id) => setItems((cur) => cur.filter((x) => x.id !== id))
  const setCaption = (id, caption) => setItems((cur) => cur.map((x) => (x.id === id ? { ...x, caption } : x)))

  const askAi = async () => {
    setErr(''); setMsg('')
    setBusy('ai')
    try {
      const r = await makeAlbumCaptions(items.map((x) => x.small))
      setTitle(r.title || title)
      setSubtitle(r.subtitle || '')
      if (r.template && !tplManual) setTpl(r.template)
      setItems((cur) => cur.map((x, i) => ({ ...x, caption: r.captions?.[i] || x.caption, ok: r.photoSpotOk?.[i] !== false, note: r.notes?.[i] || '' })))
      setMsg('AI가 제목과 문구를 만들었어요. 마음에 안 들면 직접 고칠 수 있어요.')
    } catch (e) { setErr(`${e.message} — 문구는 직접 적어도 앨범을 만들 수 있어요.`) } finally { setBusy('') }
  }

  const download = async () => {
    setErr(''); setMsg('')
    setBusy('pptx')
    try {
      await downloadAlbumPptx({ title, subtitle, items, fileName: `${title.replace(/[\\/:*?"<>|]/g, '').trim() || '제주-미니앨범'}.pptx`, template: tpl })
      setDownloaded(true)
      setMsg('PPT를 내려받았어요. 이 페이지를 나가면 사진과 슬라이드는 모두 삭제돼요.')
    } catch (e) { setErr(`PPT를 만들지 못했어요: ${e.message}`) } finally { setBusy('') }
  }

  return (
    <>
      <PageBanner img="/images/jeju-chairs.jpg" pos="50% 60%" eyebrow="미니앨범" title="내 사진으로 미니앨범 만들기"
        sub="사진 최대 5장으로 슬라이드쇼를 만들고 PPT로 내려받아요. 사진은 서버에 저장되지 않고, 내려받지 않고 나가면 모두 삭제돼요." />
      <Container className="pt-4 pb-5 jp-info">
        <div className="alert alert-light border small">
          <i className="bi bi-shield-check me-1 text-jp" />
          사진은 <b>이 브라우저 안에서만</b> 처리돼요. AI 문구를 만들 때만 줄인 사진이 AI에게 전달되고, 저장되지 않아요. 얼굴이나 개인정보가 나온 사진은 주의해서 올려 주세요.
        </div>

        {err && <div className="alert alert-warning py-2">{err}</div>}
        {msg && <div className="alert alert-success py-2">{msg}</div>}

        <div className="jp-panel mb-3">
          <div className="jp-eyebrow mb-1">1. 사진 고르기 ({items.length}/{MAX})</div>
          <input type="file" accept="image/*" multiple className="form-control" disabled={busy === 'load' || items.length >= MAX}
            onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} aria-label="사진 고르기" />
          {busy === 'load' && <div className="small text-muted mt-2"><span className="spinner-border spinner-border-sm me-2" />사진을 줄이는 중…</div>}
          {items.length > 0 && (
            <div className="d-grid gap-2 mt-3">
              {items.map((x, idx) => (
                <div key={x.id} className="d-flex gap-2 align-items-start border rounded-3 p-2 bg-white">
                  <img src={x.dataUrl} alt={x.name} style={{ width: 96, height: 72, objectFit: 'cover', borderRadius: 8 }} />
                  <div className="flex-grow-1 min-w-0">
                    <input className="form-control form-control-sm" placeholder={`${idx + 1}번 사진 문구 (직접 쓰거나 AI에게 맡기세요)`} value={x.caption} maxLength={60}
                      onChange={(e) => setCaption(x.id, e.target.value)} aria-label={`${idx + 1}번 사진 문구`} />
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
              <div className="jp-eyebrow mb-1">2. 제목과 문구</div>
              <div className="d-flex flex-wrap gap-2 mb-2">
                <input className="form-control" style={{ maxWidth: 320 }} placeholder="앨범 제목" value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} aria-label="앨범 제목" />
                <input className="form-control" style={{ maxWidth: 420 }} placeholder="부제 (선택)" value={subtitle} maxLength={80} onChange={(e) => setSubtitle(e.target.value)} aria-label="부제" />
              </div>
              <div className="d-flex flex-wrap gap-2 align-items-center">
                <button type="button" className="btn btn-primary" onClick={askAi} disabled={busy !== '' || !user}>
                  {busy === 'ai' ? <><span className="spinner-border spinner-border-sm me-2" />AI가 사진을 보는 중…</> : <><i className="bi bi-stars me-1" />AI로 제목·문구 만들기</>}
                </button>
                {!user && <span className="small text-muted"><Link to="/login">로그인</Link>하면 AI 문구를 쓸 수 있어요. 직접 적는 것은 로그인 없이도 돼요.</span>}
              </div>
            </div>

            <div className="jp-panel mb-3">
              <div className="jp-eyebrow mb-2">3. 미리보기</div>
              <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                <span className="small fw-semibold"><i className="bi bi-palette me-1" />디자인</span>
                {Object.entries(ALBUM_TEMPLATES).map(([id, t]) => (
                  <button key={id} type="button" className={`jp-month ${tpl === id ? 'on' : ''}`} onClick={() => { setTpl(id); setTplManual(true) }} title={t.desc}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: `#${t.accent}`, marginRight: 6 }} />{t.label}
                  </button>
                ))}
                <span className="small text-muted">{tplManual ? '직접 고른 디자인' : '사진 색에 맞춰 자동으로 추천했어요'} · 자동 재생은 장당 1.5초</span>
              </div>
              <Slideshow title={title} subtitle={subtitle} items={items} template={tpl} />
            </div>

            <div className="jp-panel">
              <div className="jp-eyebrow mb-2">4. 내려받기 또는 삭제</div>
              <div className="d-flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" onClick={download} disabled={busy !== ''}>
                  {busy === 'pptx' ? <><span className="spinner-border spinner-border-sm me-2" />PPT 만드는 중…</> : <><i className="bi bi-download me-1" />PPT로 내려받기 (.pptx)</>}
                </button>
                <button type="button" className="btn btn-outline-sea" onClick={() => wipe('사진과 슬라이드를 모두 삭제했어요.')} disabled={busy !== ''}><i className="bi bi-trash me-1" />모두 삭제</button>
              </div>
              <div className="small text-muted mt-2">
                {downloaded ? '내려받았어요. 이 페이지를 나가거나 15분이 지나면 사진과 슬라이드는 삭제돼요.' : '내려받지 않고 이 페이지를 나가거나 15분이 지나면 사진과 슬라이드는 자동으로 삭제돼요.'}
              </div>
            </div>
          </>
        )}
      </Container>
    </>
  )
}
