// 사진 다듬기 엔진 — 브라우저 캔버스에서 픽셀을 직접 계산한다 (Safari 등 ctx.filter 를 못 쓰는 곳에서도 같은 결과).
// AI 채팅은 "편집 명령(ops)"만 돌려주고, 실제 보정은 이 파일이 한다. 자주 쓰는 말은 parseLocal 이 AI 없이(토큰 0) 해석한다.

export const DEFAULT_EDIT = { brightness: 0, contrast: 0, saturation: 0, warmth: 0, vignette: 0, filter: 'none', crop: 'free', rotate: 0, flip: false }

export const FILTERS = { none: '원본', bw: '흑백', sepia: '세피아', vintage: '빈티지', fade: '페이드' }
export const CROPS = { free: '원본 비율', '1:1': '1:1 정사각', '4:5': '4:5 피드', '3:4': '3:4', '16:9': '16:9 가로', '9:16': '9:16 세로' }
const RATIO = { '1:1': 1, '4:5': 4 / 5, '3:4': 3 / 4, '16:9': 16 / 9, '9:16': 9 / 16 }

const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)

// 현재 편집 상태에 명령(ops)을 합친다: 숫자는 "더하기"(±), 필터·자르기·회전은 "바꾸기", reset 은 처음으로
// 사용자나 AI 가 보낸 값은 믿지 않고 항상 범위 안으로 맞춘다
export function mergeOps(edit, ops = {}) {
  if (ops.reset) return { ...DEFAULT_EDIT }
  const next = { ...DEFAULT_EDIT, ...edit }
  for (const k of ['brightness', 'contrast', 'saturation', 'warmth']) if (ops[k] !== undefined) next[k] = clamp(next[k] + num(ops[k]), -100, 100)
  if (ops.vignette !== undefined) next.vignette = clamp(next.vignette + num(ops.vignette), 0, 100)
  if (ops.filter !== undefined && FILTERS[ops.filter]) next.filter = ops.filter
  if (ops.crop !== undefined && (ops.crop === 'free' || RATIO[ops.crop])) next.crop = ops.crop
  if (ops.rotate !== undefined) next.rotate = (((next.rotate + Math.round(num(ops.rotate) / 90) * 90) % 360) + 360) % 360
  if (ops.flip) next.flip = !next.flip
  return next
}

export const isDefaultEdit = (e) => JSON.stringify({ ...DEFAULT_EDIT, ...e }) === JSON.stringify(DEFAULT_EDIT)

// ── AI 없이 해석하는 자주 쓰는 말 (토큰 0) ───────────────────────────
// 반환: { ops, done:[적용한 항목 이름] } 또는 알아듣지 못하면 null
export function parseLocal(text) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return null
  const big = /많이|확|훨씬|아주|엄청|진하게/.test(t)
  const small = /조금|살짝|약간|은은/.test(t)
  const step = big ? 30 : small ? 8 : 18
  const ops = {}
  const done = []
  const add = (k, v, label) => { ops[k] = (ops[k] ?? 0) + v; if (!done.includes(label)) done.push(label) }
  const set = (k, v, label) => { ops[k] = v; if (!done.includes(label)) done.push(label) }

  if (/원래대로|원본으로|초기화|처음으로|되돌|취소/.test(t)) return { ops: { reset: true }, done: ['처음 상태로'] }

  if (/어둡|어둑|그늘/.test(t) && !/어둡지|어둡게 하지/.test(t)) add('brightness', -step, '어둡게')
  else if (/밝/.test(t)) add('brightness', step, '밝게')
  if (/대비/.test(t)) { if (/낮|약|부드|줄/.test(t)) add('contrast', -step, '대비 낮춤'); else add('contrast', step, '대비 높임') }
  if (/선명|또렷|쨍|뚜렷/.test(t)) { add('contrast', Math.round(step * 0.6), '선명하게'); add('saturation', Math.round(step * 0.6), '선명하게') }
  if (/채도|생생|화사|색감|컬러/.test(t) && !/선명|또렷|쨍|뚜렷/.test(t)) {
    if (/낮|차분|연하|줄|죽|빠지/.test(t)) add('saturation', -step, '채도 낮춤'); else add('saturation', step, '채도 높임')
  }
  if (/따뜻|따듯|노을|황금|골든|포근/.test(t)) add('warmth', step, '따뜻하게')
  else if (/차갑|시원|쿨|푸르|파랗|청량/.test(t)) add('warmth', -step, '시원하게')
  if (/비네|가장자리.*(어둡|어둡게)|테두리.*어둡/.test(t)) add('vignette', step + 10, '가장자리 어둡게')

  if (/흑백|모노|블랙 ?앤 ?화이트/.test(t)) set('filter', 'bw', '흑백')
  else if (/세피아/.test(t)) set('filter', 'sepia', '세피아')
  else if (/빈티지|필름|레트로|옛날|올드/.test(t)) set('filter', 'vintage', '빈티지')
  else if (/페이드|바랜|몽환|뽀얗|뽀얀/.test(t)) set('filter', 'fade', '페이드')
  else if (/필터.*(없|빼|해제|끄)/.test(t)) set('filter', 'none', '필터 해제')

  if (/정사각|1:1|인스타.*피드|인스타$|인스타그램$/.test(t)) set('crop', '1:1', '1:1 자르기')
  else if (/4:5/.test(t)) set('crop', '4:5', '4:5 자르기')
  else if (/3:4/.test(t)) set('crop', '3:4', '3:4 자르기')
  else if (/9:16|스토리|릴스|쇼츠|세로로|세로 ?(사이즈|비율)/.test(t)) set('crop', '9:16', '9:16 자르기')
  else if (/16:9|와이드|유튜브|가로로|시네마|가로 ?(사이즈|비율)/.test(t)) set('crop', '16:9', '16:9 자르기')

  if (/좌우 ?반전|거울|뒤집/.test(t)) { ops.flip = true; done.push('좌우 반전') }
  if (/반시계|왼쪽으로 ?(회전|돌)/.test(t)) set('rotate', -90, '왼쪽 회전')
  else if (/회전|돌려/.test(t)) set('rotate', 90, '오른쪽 회전')

  return done.length ? { ops, done } : null
}

// ── 그리기 ────────────────────────────────────────────────────────
const loadImg = (src) => new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.src = src })
export const loadEditImage = loadImg

// 원본 그림에 편집을 입혀 data URL 로 돌려준다 (원본은 건드리지 않는다)
export async function applyEdit(src, edit, maxEdge = 1600, quality = 0.82) {
  const e = { ...DEFAULT_EDIT, ...edit }
  const im = typeof src === 'string' ? await loadImg(src) : src
  const turn = e.rotate % 180 !== 0
  const sw = turn ? im.naturalHeight : im.naturalWidth
  const sh = turn ? im.naturalWidth : im.naturalHeight
  const ratio = RATIO[e.crop]
  let cw = sw
  let ch = sh
  if (ratio) { if (sw / sh > ratio) cw = Math.round(sh * ratio); else ch = Math.round(sw / ratio) }
  const scale = Math.min(1, maxEdge / Math.max(cw, ch))
  const w = Math.max(1, Math.round(cw * scale))
  const h = Math.max(1, Math.round(ch * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.rotate((e.rotate * Math.PI) / 180)
  if (e.flip) ctx.scale(-1, 1)
  // 회전한 뒤의 가운데 cw×ch 영역이 캔버스에 꽉 차게 그린다
  const ow = turn ? im.naturalHeight : im.naturalWidth
  const oh = turn ? im.naturalWidth : im.naturalHeight
  const k = scale
  const dw = (turn ? oh : ow) * k
  const dh = (turn ? ow : oh) * k
  ctx.drawImage(im, -dw / 2, -dh / 2, dw, dh)
  ctx.restore()

  const plain = e.brightness === 0 && e.contrast === 0 && e.saturation === 0 && e.warmth === 0 && e.vignette === 0 && e.filter === 'none'
  if (!plain) {
    const img = ctx.getImageData(0, 0, w, h)
    const d = img.data
    const cf = e.contrast ? (259 * (e.contrast * 2.55 + 255)) / (255 * (259 - e.contrast * 2.55)) : 1
    const sat = 1 + e.saturation / 100
    const br = e.brightness * 1.4
    const wm = e.warmth * 0.45
    const vg = e.vignette / 100
    const cx = w / 2
    const cy = h / 2
    const maxD = cx * cx + cy * cy
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const i = (y * w + x) * 4
        let r = d[i]
        let g = d[i + 1]
        let b = d[i + 2]
        r += br + wm; g += br; b += br - wm
        if (cf !== 1) { r = cf * (r - 128) + 128; g = cf * (g - 128) + 128; b = cf * (b - 128) + 128 }
        let gray = 0.299 * r + 0.587 * g + 0.114 * b
        if (sat !== 1) { r = gray + (r - gray) * sat; g = gray + (g - gray) * sat; b = gray + (b - gray) * sat }
        if (e.filter === 'bw') { gray = 0.299 * r + 0.587 * g + 0.114 * b; r = gray; g = gray; b = gray }
        else if (e.filter === 'sepia' || e.filter === 'vintage') {
          const a = e.filter === 'sepia' ? 1 : 0.55
          const sr = 0.393 * r + 0.769 * g + 0.189 * b
          const sg = 0.349 * r + 0.686 * g + 0.168 * b
          const sb = 0.272 * r + 0.534 * g + 0.131 * b
          r += (sr - r) * a; g += (sg - g) * a; b += (sb - b) * a
          if (e.filter === 'vintage') { r = r * 0.9 + 22; g = g * 0.9 + 18; b = b * 0.9 + 16 }
        } else if (e.filter === 'fade') {
          r = r * 0.82 + 38; g = g * 0.82 + 38; b = b * 0.82 + 42
        }
        if (vg) {
          const dx = x - cx
          const dy = y - cy
          const f = 1 - vg * Math.pow((dx * dx + dy * dy) / maxD, 1.4) * 1.1
          r *= f; g *= f; b *= f
        }
        d[i] = r < 0 ? 0 : r > 255 ? 255 : r
        d[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g
        d[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b
      }
    }
    ctx.putImageData(img, 0, 0)
  }
  return { dataUrl: canvas.toDataURL('image/jpeg', quality), width: w, height: h, canvas }
}

// 편집한 결과 → 앨범에서 쓰는 큰 그림(1600px)과 AI 에 보낼 작은 그림(1024px)
export async function renderEdited(origUrl, edit) {
  const im = await loadImg(origUrl)
  const full = await applyEdit(im, edit, 1600, 0.82)
  const small = await applyEdit(im, edit, 1024, 0.72)
  return { dataUrl: full.dataUrl, width: full.width, height: full.height, small: small.dataUrl }
}
