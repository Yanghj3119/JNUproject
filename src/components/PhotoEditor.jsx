import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { editPhotoWithAi, aiEditLeft } from '../api/client'
import { CROPS, DEFAULT_EDIT, FILTERS, isDefaultEdit, mergeOps, parseLocal, renderEdited } from '../lib/photoEdit'
import { saveBlob } from '../lib/albumVideo'

// 예시 칩 — 누르면 AI 를 거치지 않고(토큰 0) 바로 적용된다
const CHIPS = ['더 따뜻하게', '밝고 선명하게', '필름 느낌', '차분한 흑백', '인스타용 정사각형', '노을빛으로']
const SLIDERS = [
  ['brightness', '밝기', -100, 100],
  ['contrast', '대비', -100, 100],
  ['saturation', '채도', -100, 100],
  ['warmth', '따뜻함', -100, 100],
  ['vignette', '가장자리 어둡게', 0, 100],
]

// 사진 다듬기 — 슬라이더·필터·자르기는 무제한 무료, 말로 하는 요청은 먼저 코드가 해석하고 못 알아들을 때만 AI(하루 10회)를 쓴다.
// items: 앨범 사진 목록, onChange(id, patch): 다듬은 결과(dataUrl·small·width·height·edit·rev)를 돌려준다
export default function PhotoEditor({ items, onChange, user }) {
  const [selId, setSelId] = useState(null)
  const [text, setText] = useState('')
  const [chat, setChat] = useState([]) // [{ role:'me'|'ai', text }]
  const [busy, setBusy] = useState(false)
  const [working, setWorking] = useState(false)
  const [left, setLeft] = useState(undefined) // undefined: 확인 전, null: 사용 불가, 숫자: 남은 횟수
  const hist = useRef(new Map()) // id → 되돌리기용 편집 상태들
  const timer = useRef(null)
  const lastPush = useRef(0)
  const seq = useRef(0)
  const cur = items.find((x) => x.id === selId) ?? items[0] ?? null

  useEffect(() => { if (items.length && !items.some((x) => x.id === selId)) setSelId(items[0].id) }, [items, selId])
  useEffect(() => {
    let alive = true
    if (!user) { setLeft(null); return undefined }
    aiEditLeft().then((d) => { if (alive) setLeft(d ? d.left : null) }).catch(() => { if (alive) setLeft(null) })
    return () => { alive = false }
  }, [user])
  useEffect(() => () => clearTimeout(timer.current), [])

  // 편집 상태를 바꾸고 사진을 다시 그린다 (원본에서 매번 새로 그리므로 되돌려도 화질이 안 떨어진다)
  const commit = useCallback((item, edit, { push = true, wait = 0 } = {}) => {
    if (push) {
      const h = hist.current.get(item.id) ?? []
      hist.current.set(item.id, [...h.slice(-14), item.edit ?? DEFAULT_EDIT])
    }
    onChange(item.id, { edit }) // 슬라이더 값은 바로 반영하고, 그림은 잠깐 뒤에 그린다
    clearTimeout(timer.current)
    const my = ++seq.current
    timer.current = setTimeout(async () => {
      setWorking(true)
      try {
        const out = await renderEdited(item.origFull, edit)
        if (my === seq.current) onChange(item.id, { ...out, edit, rev: Math.random() }) // 더 새로운 편집이 있으면 이 결과는 버린다
      } finally { if (my === seq.current) setWorking(false) }
    }, wait)
  }, [onChange])

  const apply = (ops, note) => {
    if (!cur) return
    commit(cur, mergeOps(cur.edit ?? DEFAULT_EDIT, ops), { wait: 0 })
    if (note) setChat((c) => [...c, { role: 'ai', text: note }].slice(-6))
  }
  const slide = (key, v) => {
    if (!cur) return
    const next = { ...(cur.edit ?? DEFAULT_EDIT), [key]: Number(v) }
    // 슬라이더는 끌 때마다 되돌리기를 쌓지 않는다 (잠깐 쉬었다가 다시 움직일 때만)
    const now = Date.now()
    const push = now - lastPush.current > 1500
    if (push) lastPush.current = now
    commit(cur, next, { push, wait: 180 })
  }
  const undo = () => {
    if (!cur) return
    const h = hist.current.get(cur.id) ?? []
    if (!h.length) return
    const prev = h[h.length - 1]
    hist.current.set(cur.id, h.slice(0, -1))
    commit(cur, prev, { push: false })
  }

  const send = async (raw) => {
    const q = String(raw ?? text).trim()
    if (!q || !cur || busy) return
    setText('')
    setChat((c) => [...c, { role: 'me', text: q }].slice(-6))
    const local = parseLocal(q)
    if (local) return apply(local.ops, `${local.done.join(', ')} 적용했어요. (AI 없이 처리 · 횟수 차감 없음)`)
    if (!user) return setChat((c) => [...c, { role: 'ai', text: '이 요청은 AI가 필요해요. 로그인하면 하루 10번까지 쓸 수 있어요.' }])
    if (left === 0) return setChat((c) => [...c, { role: 'ai', text: '오늘 AI 편집을 모두 썼어요. 슬라이더·필터·예시 버튼은 계속 쓸 수 있어요.' }])
    setBusy(true)
    try {
      const history = chat.slice(-4).map((m) => ({ role: m.role === 'me' ? 'user' : 'ai', text: m.text }))
      const r = await editPhotoWithAi({ text: q, edit: cur.edit ?? DEFAULT_EDIT, image: /사진|하늘|바다|배경|색|느낌|분위기|어둡|밝/.test(q) ? cur.small : undefined, history })
      const nl = typeof r.left === 'number' ? r.left : null
      if (nl !== null) setLeft(nl)
      const tail = nl !== null ? ` (AI 사용 · 오늘 ${nl}회 남음)` : ' (AI 사용)'
      if (r.ops && Object.keys(r.ops).length) apply(r.ops, `${r.reply || '적용했어요.'}${tail}`)
      else setChat((c) => [...c, { role: 'ai', text: `${r.reply || '이 요청은 적용할 수 있는 보정이 없어요.'}${tail}` }].slice(-6))
    } catch (e) {
      if (typeof e.left === 'number') setLeft(e.left)
      setChat((c) => [...c, { role: 'ai', text: e.message }].slice(-6))
    } finally { setBusy(false) }
  }

  const save = async (x) => {
    const blob = await (await fetch(x.dataUrl)).blob()
    saveBlob(blob, `${(x.name || '사진').replace(/\.[^.]+$/, '')}-편집.jpg`)
  }

  if (!cur) return null
  const e = { ...DEFAULT_EDIT, ...(cur.edit ?? {}) }
  const dirty = !isDefaultEdit(e)

  return (
    <div>
      {items.length > 1 && (
        <div className="d-flex flex-wrap gap-2 mb-2">
          {items.map((x, i) => (
            <button key={x.id} type="button" className={`jp-month ${cur.id === x.id ? 'on' : ''}`} onClick={() => setSelId(x.id)}>{i + 1}번 사진{!isDefaultEdit(x.edit ?? DEFAULT_EDIT) && ' ✓'}</button>
          ))}
        </div>
      )}
      <div className="row g-3">
        <div className="col-lg-6">
          <div className="position-relative border rounded-3 bg-white d-flex align-items-center justify-content-center" style={{ minHeight: 240, padding: 6 }}>
            <img src={cur.dataUrl} alt="편집 중인 사진" style={{ maxWidth: '100%', maxHeight: 420, borderRadius: 6 }} />
            {working && <span className="spinner-border spinner-border-sm position-absolute top-0 end-0 m-2 text-secondary" />}
          </div>
          <div className="d-flex flex-wrap gap-2 mt-2">
            <button type="button" className="btn btn-sm btn-outline-sea" onClick={undo} disabled={!(hist.current.get(cur.id) ?? []).length}><i className="bi bi-arrow-counterclockwise me-1" />되돌리기</button>
            <button type="button" className="btn btn-sm btn-outline-sea" onClick={() => apply({ reset: true })} disabled={!dirty}>원본으로</button>
            <button type="button" className="btn btn-sm btn-outline-sea" onClick={() => apply({ rotate: 90 })}><i className="bi bi-arrow-clockwise me-1" />회전</button>
            <button type="button" className="btn btn-sm btn-outline-sea" onClick={() => apply({ flip: true })}><i className="bi bi-symmetry-vertical me-1" />좌우 반전</button>
            <button type="button" className="btn btn-sm btn-primary ms-auto" onClick={() => save(cur)}><i className="bi bi-download me-1" />이 사진 저장</button>
          </div>
        </div>

        <div className="col-lg-6">
          <div className="mb-2">
            <div className="small fw-semibold mb-1">말로 다듬기</div>
            <div className="d-flex flex-wrap gap-1 mb-2">
              {CHIPS.map((c) => <button key={c} type="button" className="jp-month" onClick={() => send(c)} disabled={busy}>{c}</button>)}
            </div>
            {chat.length > 0 && (
              <div className="border rounded-3 bg-white p-2 mb-2 small" style={{ maxHeight: 130, overflowY: 'auto' }}>
                {chat.map((m, i) => <div key={i} className={m.role === 'me' ? 'text-end text-muted' : ''}>{m.role === 'ai' && <i className="bi bi-stars me-1" />}{m.text}</div>)}
              </div>
            )}
            <form className="d-flex gap-2" onSubmit={(ev) => { ev.preventDefault(); send() }}>
              <input className="form-control" value={text} maxLength={200} onChange={(ev) => setText(ev.target.value)} placeholder="예) 하늘을 더 파랗게, 따뜻한 필름 느낌으로" aria-label="다듬을 내용" />
              <button className="btn btn-primary" type="submit" disabled={busy || !text.trim()}>{busy ? <span className="spinner-border spinner-border-sm" /> : '적용'}</button>
            </form>
            <div className="small text-muted mt-1">
              자주 쓰는 말(밝게·흑백·정사각형 등)은 AI 없이 바로 적용돼요.
              {left === undefined ? '' : user
                ? (left === null ? ' AI 편집은 준비 중이에요.' : ` 그 밖의 요청은 AI가 해석하며 오늘 ${left}회 남았어요 (하루 10회).`)
                : <> 그 밖의 요청은 <Link to="/login">로그인</Link> 후 AI가 해석해요 (하루 10회).</>}
            </div>
          </div>

          <div className="small fw-semibold mt-3 mb-1">직접 조절 <span className="text-muted fw-normal">(무제한)</span></div>
          {SLIDERS.map(([k, label, min, max]) => (
            <div key={k} className="d-flex align-items-center gap-2 small">
              <span style={{ width: 96 }}>{label}</span>
              <input type="range" className="form-range flex-grow-1" min={min} max={max} value={e[k]} onChange={(ev) => slide(k, ev.target.value)} aria-label={label} />
              <span className="text-muted" style={{ width: 30, textAlign: 'right' }}>{e[k]}</span>
            </div>
          ))}
          <div className="d-flex flex-wrap gap-1 mt-2">
            {Object.entries(FILTERS).map(([k, label]) => <button key={k} type="button" className={`jp-month ${e.filter === k ? 'on' : ''}`} onClick={() => apply({ filter: k })}>{label}</button>)}
          </div>
          <div className="d-flex flex-wrap gap-1 mt-2">
            {Object.entries(CROPS).map(([k, label]) => <button key={k} type="button" className={`jp-month ${e.crop === k ? 'on' : ''}`} onClick={() => apply({ crop: k })}>{label}</button>)}
          </div>
        </div>
      </div>
    </div>
  )
}
