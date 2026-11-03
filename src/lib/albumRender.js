// 미니앨범 페이지 그리기 — 템플릿마다 1920x1080 한 장씩 캔버스에 그린다.
// 미리보기와 PPT 가 같은 그림을 쓰기 때문에 보이는 모습이 똑같고, 모두 이 브라우저 안에서만 처리된다.
export const W = 1920
export const H = 1080
const SERIF = '"Batang", "AppleMyungjo", "Noto Serif KR", "Nanum Myeongjo", serif'
const SANS = '"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
const MONO = '"Consolas", "Menlo", "Courier New", monospace'

const loadImg = (src) => new Promise((resolve) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = src })
const pad2 = (n) => String(n).padStart(2, '0')
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

function cover(ctx, im, x, y, w, h) {
  if (!im) { ctx.fillStyle = '#888'; ctx.fillRect(x, y, w, h); return }
  const r = Math.max(w / im.width, h / im.height)
  const sw = w / r
  const sh = h / r
  ctx.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, x, y, w, h)
}

// 글자를 maxW 안에서 줄바꿈 (공백이 있으면 단어, 없으면 글자 단위)
function wrap(ctx, text, maxW, maxLines = 3) {
  const out = []
  let line = ''
  for (const ch of String(text ?? '')) {
    const t = line + ch
    if (ctx.measureText(t).width > maxW && line) { out.push(line.trim()); line = ch === ' ' ? '' : ch } else line = t
    if (out.length >= maxLines) break
  }
  if (line.trim() && out.length < maxLines) out.push(line.trim())
  return out
}
// 글 덩어리의 세로 가운데가 cy 가 되게 그린다 (textBaseline 은 middle 로 맞춘다)
function centerBlock(ctx, text, cx, cy, maxW, lineH, maxLines = 2) {
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  const lines = wrap(ctx, text, maxW, maxLines)
  const y0 = cy - ((lines.length - 1) * lineH) / 2
  lines.forEach((l, i) => ctx.fillText(l, cx, y0 + i * lineH))
  return lines.length
}
function centerText(ctx, text, cx, y, maxW, lineH, maxLines = 3) {
  const lines = wrap(ctx, text, maxW, maxLines)
  lines.forEach((l, i) => ctx.fillText(l, cx, y + i * lineH))
  return lines.length
}

// 종이 바탕 + 은은한 결(점·섬유)
function paper(ctx, c1, c2, grain = 0.06, seed = 3, fiber = false) {
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, c1)
  g.addColorStop(1, c2)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const r = rng(seed)
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = r() > 0.5 ? `rgba(255,255,255,${grain})` : `rgba(80,50,20,${grain})`
    ctx.fillRect(r() * W, r() * H, 1 + r() * 2.2, 1 + r() * 2.2)
  }
  if (fiber) {
    ctx.strokeStyle = 'rgba(90,60,25,0.07)'
    ctx.lineWidth = 1
    for (let i = 0; i < 260; i++) {
      const x = r() * W, y = r() * H, l = 20 + r() * 60, a = r() * Math.PI
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke()
    }
  }
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 0.95)
  v.addColorStop(0, 'rgba(0,0,0,0)')
  v.addColorStop(1, 'rgba(60,40,15,0.22)')
  ctx.fillStyle = v
  ctx.fillRect(0, 0, W, H)
}

function shadowOn(ctx, blur = 40, dy = 16, a = 0.3) { ctx.shadowColor = `rgba(40,25,5,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = dy }
function shadowOff(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0 }

function tape(ctx, x, y, w, h, rot, color) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.fillStyle = color
  ctx.fillRect(-w / 2, -h / 2, w, h)
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.setLineDash([6, 6])
  ctx.strokeRect(-w / 2 + 4, -h / 2 + 4, w - 8, h - 8)
  ctx.restore()
}

function star(ctx, cx, cy, r, color, rot = 0) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r
    const a = (Math.PI / 5) * i - Math.PI / 2
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

// ── 폴라로이드 ────────────────────────────────────────────────
function polaroidCard(ctx, im, cx, cy, rot, cw, ch, pad, photoH, caption, capFont = 44) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  shadowOn(ctx, 45, 18, 0.35)
  ctx.fillStyle = '#fffdf8'
  ctx.fillRect(-cw / 2, -ch / 2, cw, ch)
  shadowOff(ctx)
  const px = -cw / 2 + pad
  const py = -ch / 2 + pad
  cover(ctx, im, px, py, cw - pad * 2, photoH)
  ctx.strokeStyle = 'rgba(0,0,0,0.14)'
  ctx.lineWidth = 2
  ctx.strokeRect(px, py, cw - pad * 2, photoH)
  if (caption) {
    ctx.fillStyle = '#3a2f22'
    ctx.font = `italic ${capFont}px ${SERIF}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const y0 = py + photoH
    centerBlock(ctx, caption, 0, y0 + (ch / 2 - y0) / 2, cw - pad * 2 - 20, capFont * 1.3, 2)
  }
  ctx.restore()
}

function drawPolaroid(ctx, p) {
  paper(ctx, '#f6efe0', '#e8dbc1', 0.06, 7)
  ctx.textBaseline = 'alphabetic'
  if (p.type === 'cover') {
    const [a, b] = p.images
    if (b) polaroidCard(ctx, b, 1450, 520, 0.1, 640, 700, 30, 480, '', 36)
    polaroidCard(ctx, a, 1330, 560, -0.07, 700, 780, 34, 540, '', 36)
    ctx.fillStyle = '#3a2f22'
    ctx.textAlign = 'left'
    ctx.font = `italic 34px ${SERIF}`
    ctx.fillText('— Jeju Photo Album —', 150, 330)
    ctx.font = `bold 92px ${SERIF}`
    ctx.textBaseline = 'top'
    const n = wrap(ctx, p.title, 780, 2)
    n.forEach((l, i) => ctx.fillText(l, 150, 370 + i * 112))
    ctx.textBaseline = 'alphabetic'
    ctx.font = `38px ${SERIF}`
    ctx.fillStyle = 'rgba(58,47,34,0.8)'
    centerLeft(ctx, p.subtitle, 150, 400 + n.length * 112, 780, 52)
    ctx.font = `30px ${MONO}`
    ctx.fillStyle = 'rgba(58,47,34,0.6)'
    ctx.fillText(p.date, 150, H - 120)
    return
  }
  if (p.type === 'index') {
    ctx.fillStyle = '#3a2f22'
    ctx.textAlign = 'center'
    ctx.font = `italic 56px ${SERIF}`
    ctx.fillText('Our Jeju Days', W / 2, 170)
    const n = p.images.length
    const cw = Math.min(330, (W - 200) / n - 30)
    p.images.forEach((im, i) => {
      const cx = W / 2 + (i - (n - 1) / 2) * (cw + 36)
      polaroidCard(ctx, im, cx, 560 + (i % 2 ? 40 : -20), (i % 2 ? 1 : -1) * 0.04, cw, cw * 1.18, 20, cw - 40, '', 30)
      ctx.fillStyle = 'rgba(58,47,34,0.7)'
      ctx.font = `28px ${MONO}`
      ctx.textAlign = 'center'
      ctx.fillText(pad2(i + 1), cx, 560 + cw * 0.59 + 90)
    })
    ctx.font = `32px ${SERIF}`
    ctx.fillStyle = 'rgba(58,47,34,0.75)'
    ctx.fillText(`${p.title}  ·  ${p.date}`, W / 2, H - 110)
    return
  }
  // 사진 한 장
  const rot = (p.index % 2 ? 1 : -1) * 0.035
  polaroidCard(ctx, p.im, W / 2, H / 2 - 10, rot, 900, 900, 40, 660, p.caption, 46)
  ctx.save()
  ctx.translate(W / 2, H / 2 - 10)
  ctx.rotate(rot)
  tape(ctx, -330, -450, 190, 56, -0.35, 'rgba(250,215,120,0.78)')
  tape(ctx, 330, -450, 190, 56, 0.3, 'rgba(250,215,120,0.78)')
  ctx.restore()
  ctx.fillStyle = 'rgba(58,47,34,0.65)'
  ctx.font = `30px ${MONO}`
  ctx.textAlign = 'left'
  ctx.fillText(`No. ${pad2(p.index + 1)} / ${pad2(p.total)}`, 130, H - 80)
  ctx.textAlign = 'right'
  ctx.fillText(p.date, W - 130, H - 80)
}

function centerLeft(ctx, text, x, y, maxW, lineH) {
  ctx.textAlign = 'left'
  wrap(ctx, text, maxW, 3).forEach((l, i) => ctx.fillText(l, x, y + i * lineH))
}

// ── 필름 ────────────────────────────────────────────────────
function filmStrip(ctx, y) {
  ctx.fillStyle = '#1b1b1e'
  ctx.fillRect(0, y, W, 74)
  for (let x = 20; x < W; x += 66) {
    ctx.fillStyle = '#0b0b0d'
    ctx.beginPath()
    ctx.roundRect(x, y + 25, 36, 26, 6)
    ctx.fill()
  }
}
function drawFilm(ctx, p) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#0f0f12')
  g.addColorStop(1, '#17171c')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  filmStrip(ctx, 0)
  filmStrip(ctx, H - 74)
  const ORANGE = '#ffb02e'
  ctx.textBaseline = 'alphabetic'
  if (p.type === 'cover') {
    // 아래쪽에 필름 컷 3장
    const imgs = p.images.slice(0, 3)
    imgs.forEach((im, i) => {
      const x = 330 + i * 430
      ctx.fillStyle = '#000'
      ctx.fillRect(x - 8, 640, 396, 290)
      cover(ctx, im, x, 648, 380, 274)
      ctx.fillStyle = ORANGE
      ctx.font = `22px ${MONO}`
      ctx.textAlign = 'left'
      ctx.fillText(`${i + 1}  ▶`, x, 960)
    })
    ctx.textAlign = 'center'
    ctx.fillStyle = ORANGE
    ctx.font = `26px ${MONO}`
    ctx.fillText('JEJU  400   ▸ ▸ ▸   36 EXP', W / 2, 220)
    ctx.fillStyle = '#fff'
    ctx.font = `bold 110px ${SANS}`
    centerText(ctx, p.title, W / 2, 360, W - 400, 130, 2)
    ctx.fillStyle = 'rgba(255,255,255,0.78)'
    ctx.font = `40px ${SANS}`
    centerText(ctx, p.subtitle, W / 2, 520, W - 500, 54, 2)
    ctx.fillStyle = ORANGE
    ctx.font = `28px ${MONO}`
    ctx.fillText(p.date, W / 2, 600)
    return
  }
  if (p.type === 'index') {
    ctx.textAlign = 'center'
    ctx.fillStyle = ORANGE
    ctx.font = `30px ${MONO}`
    ctx.fillText('CONTACT SHEET', W / 2, 190)
    const n = p.images.length
    const cw = Math.min(330, (W - 220) / n - 20)
    p.images.forEach((im, i) => {
      const x = W / 2 + (i - (n - 1) / 2) * (cw + 22) - cw / 2
      ctx.fillStyle = '#000'
      ctx.fillRect(x - 8, 300, cw + 16, cw * 0.75 + 16)
      cover(ctx, im, x, 308, cw, cw * 0.75)
      ctx.fillStyle = ORANGE
      ctx.font = `24px ${MONO}`
      ctx.textAlign = 'left'
      ctx.fillText(`${i + 1}A`, x, 308 + cw * 0.75 + 52)
    })
    ctx.textAlign = 'center'
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.font = `36px ${SANS}`
    ctx.fillText(`${p.title}  ·  ${p.date}`, W / 2, H - 160)
    return
  }
  // 사진 한 컷
  const x = 220, y = 112, w = 1480, h = 722
  ctx.fillStyle = '#000'
  ctx.fillRect(x - 12, y - 12, w + 24, h + 24)
  ctx.save()
  try { ctx.filter = 'sepia(0.22) contrast(1.06) saturate(1.1)' } catch { /* 필터를 못 쓰는 브라우저 */ }
  cover(ctx, p.im, x, y, w, h)
  ctx.restore()
  const vg = ctx.createRadialGradient(W / 2, y + h / 2, h * 0.35, W / 2, y + h / 2, h * 0.95)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.fillStyle = vg
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = ORANGE
  ctx.font = `26px ${MONO}`
  ctx.textAlign = 'left'
  ctx.fillText(`▶ ${p.index + 1}`, x, y + h + 56)
  ctx.textAlign = 'right'
  ctx.fillText(`${p.index + 1}A   JEJU 400`, x + w, y + h + 56)
  if (p.caption) {
    ctx.textAlign = 'center'
    ctx.fillStyle = '#fff'
    ctx.font = `40px ${SANS}`
    centerBlock(ctx, p.caption, W / 2, H - 128, w, 50, 1)
  }
}

// ── 스크랩북 ─────────────────────────────────────────────────
function scrapDecor(ctx, seed, avoid) {
  const r = rng(seed)
  const colors = ['#f59e0b', '#ef4444', '#fff7ed', '#22c55e', '#38bdf8']
  for (let i = 0; i < 9; i++) {
    const x = r() * W, y = r() * H
    if (x > avoid[0] && x < avoid[2] && y > avoid[1] && y < avoid[3]) continue
    star(ctx, x, y, 16 + r() * 16, colors[i % colors.length], r() * 1.2)
  }
}
function stamp(ctx, cx, cy, date) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-0.2)
  ctx.strokeStyle = 'rgba(120,70,35,0.75)'
  ctx.lineWidth = 5
  ctx.beginPath(); ctx.arc(0, 0, 84, 0, Math.PI * 2); ctx.stroke()
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.arc(0, 0, 72, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = 'rgba(120,70,35,0.8)'
  ctx.textAlign = 'center'
  ctx.font = `bold 30px ${MONO}`
  ctx.fillText('JEJU', 0, -4)
  ctx.font = `20px ${MONO}`
  ctx.fillText(date, 0, 28)
  ctx.restore()
}
function whiteFrame(ctx, im, cx, cy, rot, w, h, border) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  shadowOn(ctx, 30, 12, 0.35)
  ctx.fillStyle = '#fffdf7'
  ctx.fillRect(-w / 2 - border, -h / 2 - border, w + border * 2, h + border * 2)
  shadowOff(ctx)
  cover(ctx, im, -w / 2, -h / 2, w, h)
  ctx.restore()
}
function label(ctx, cx, cy, rot, w, h, text, font = 42) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  shadowOn(ctx, 20, 8, 0.3)
  ctx.fillStyle = '#fff8e8'
  ctx.fillRect(-w / 2, -h / 2, w, h)
  shadowOff(ctx)
  ctx.strokeStyle = 'rgba(120,80,40,0.55)'
  ctx.setLineDash([10, 8])
  ctx.lineWidth = 2
  ctx.strokeRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24)
  ctx.setLineDash([])
  ctx.fillStyle = '#4a3320'
  ctx.font = `italic ${font}px ${SERIF}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  centerBlock(ctx, text, 0, 0, w - 70, font * 1.3, 2)
  ctx.restore()
}
function drawScrap(ctx, p) {
  paper(ctx, '#cfa977', '#b98d5a', 0.08, 11, true)
  ctx.textBaseline = 'alphabetic'
  if (p.type === 'cover') {
    const imgs = p.images.slice(0, 3)
    const pos = [[1330, 470, -0.07], [1560, 640, 0.08], [1180, 700, 0.03]]
    imgs.forEach((im, i) => whiteFrame(ctx, im, pos[i][0], pos[i][1], pos[i][2], 380, 280, 18))
    tape(ctx, 1330, 300, 170, 50, -0.3, 'rgba(244,114,182,0.7)')
    label(ctx, 560, 470, -0.03, 820, 360, p.title, 76)
    ctx.fillStyle = '#4a3320'
    ctx.font = `36px ${SERIF}`
    ctx.textAlign = 'center'
    centerText(ctx, p.subtitle, 560, 740, 760, 48, 2)
    stamp(ctx, 220, 220, p.date)
    scrapDecor(ctx, 5, [100, 200, 1000, 800])
    return
  }
  if (p.type === 'index') {
    ctx.fillStyle = '#4a3320'
    ctx.font = `italic 60px ${SERIF}`
    ctx.textAlign = 'center'
    ctx.fillText('Memories of Jeju', W / 2, 160)
    const n = p.images.length
    p.images.forEach((im, i) => {
      const cx = W / 2 + (i - (n - 1) / 2) * 330
      whiteFrame(ctx, im, cx, 560 + (i % 2 ? 50 : -30), (i % 2 ? 1 : -1) * 0.05, 270, 200, 14)
      tape(ctx, cx, 560 + (i % 2 ? 50 : -30) - 130, 120, 38, (i % 2 ? 0.3 : -0.3), i % 2 ? 'rgba(45,212,191,0.7)' : 'rgba(244,114,182,0.7)')
    })
    stamp(ctx, W - 230, H - 190, p.date)
    scrapDecor(ctx, 9, [200, 300, 1700, 850])
    return
  }
  const rot = (p.index % 2 ? 1 : -1) * 0.03
  whiteFrame(ctx, p.im, 900, 500, rot, 1000, 660, 28)
  tape(ctx, 560, 150, 190, 54, -0.4, 'rgba(244,114,182,0.72)')
  tape(ctx, 1250, 160, 190, 54, 0.35, 'rgba(45,212,191,0.72)')
  if (p.caption) label(ctx, 1210, 900, 0.025 * (p.index % 2 ? -1 : 1), 880, 150, p.caption, 42)
  stamp(ctx, 1700, 230, p.date)
  ctx.fillStyle = 'rgba(74,51,32,0.75)'
  ctx.font = `28px ${MONO}`
  ctx.textAlign = 'left'
  ctx.fillText(`#${pad2(p.index + 1)}  /  ${pad2(p.total)}`, 120, H - 70)
  scrapDecor(ctx, 20 + p.index, [260, 80, 1560, 960])
}

// ── 갤러리 액자 ─────────────────────────────────────────────
function wall(ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#f1efe9')
  g.addColorStop(1, '#dedbd2')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const s = ctx.createRadialGradient(W / 2, -80, 100, W / 2, 380, 1100)
  s.addColorStop(0, 'rgba(255,255,255,0.85)')
  s.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = s
  ctx.fillRect(0, 0, W, H)
}
function frame(ctx, im, cx, cy, w, h, mat = 70) {
  const fw = w + mat * 2
  const fh = h + mat * 2
  ctx.save()
  shadowOn(ctx, 50, 26, 0.35)
  ctx.fillStyle = '#16120e'
  ctx.fillRect(cx - fw / 2 - 18, cy - fh / 2 - 18, fw + 36, fh + 36)
  shadowOff(ctx)
  ctx.fillStyle = '#fbfaf7'
  ctx.fillRect(cx - fw / 2, cy - fh / 2, fw, fh)
  cover(ctx, im, cx - w / 2, cy - h / 2, w, h)
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'
  ctx.lineWidth = 2
  ctx.strokeRect(cx - w / 2, cy - h / 2, w, h)
  ctx.restore()
}
function plaque(ctx, cx, cy, w, h, line1, line2) {
  ctx.save()
  shadowOn(ctx, 16, 6, 0.25)
  ctx.fillStyle = '#fffefb'
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h)
  shadowOff(ctx)
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 2
  ctx.strokeRect(cx - w / 2 + 8, cy - h / 2 + 8, w - 16, h - 16)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#26211b'
  ctx.font = `bold 34px ${SERIF}`
  ctx.font = `bold 34px ${SERIF}`
  const nl = Math.min(2, wrap(ctx, line1 || '', w - 70, 2).length)
  const blockH = nl * 42 + (line2 ? 36 : 0)
  centerBlock(ctx, line1 || '', cx, cy - blockH / 2 + (nl * 42) / 2, w - 70, 42, 2)
  if (line2) {
    ctx.fillStyle = '#7a7266'
    ctx.font = `22px ${SERIF}`
    ctx.fillText(line2, cx, cy - blockH / 2 + nl * 42 + 18)
  }
  ctx.restore()
}
function drawGallery(ctx, p) {
  wall(ctx)
  ctx.textBaseline = 'alphabetic'
  if (p.type === 'cover') {
    const imgs = p.images.slice(0, 3)
    const xs = [380, 960, 1540]
    imgs.forEach((im, i) => frame(ctx, im, xs[i], 360, 330, 230, 34))
    plaque(ctx, W / 2, 800, 900, 210, p.title, p.subtitle || p.date)
    ctx.fillStyle = '#7a7266'
    ctx.font = `24px ${SERIF}`
    ctx.textAlign = 'center'
    ctx.fillText(`JEJU PHOTO EXHIBITION  ·  ${p.date}`, W / 2, 970)
    return
  }
  if (p.type === 'index') {
    const n = p.images.length
    p.images.forEach((im, i) => frame(ctx, im, W / 2 + (i - (n - 1) / 2) * 360, 470, 250, 190, 28))
    plaque(ctx, W / 2, 860, 760, 150, '전시를 마치며', `${p.title}  ·  ${p.date}`)
    return
  }
  frame(ctx, p.im, W / 2, 440, 1100, 620, 66)
  const cap = p.caption || p.title
  plaque(ctx, W / 2, 920, 980, 120, cap, `Jeju  ·  ${p.date}  ·  ${p.index + 1}/${p.total}`)
}

// ── 시네마틱(사진 가득 + 아래 띠) ───────────────────────────────
function drawCinema(ctx, p, T) {
  ctx.textBaseline = 'alphabetic'
  const hex = (c) => `#${c}`
  if (p.type === 'photo') {
    cover(ctx, p.im, 0, 0, W, H)
    if (p.caption) {
      ctx.fillStyle = `rgba(${parseInt(T.bar.slice(0, 2), 16)},${parseInt(T.bar.slice(2, 4), 16)},${parseInt(T.bar.slice(4, 6), 16)},0.72)`
      ctx.fillRect(0, H - 190, W, 190)
      ctx.fillStyle = hex(T.accent)
      ctx.fillRect(0, H - 190, W, 6)
      ctx.fillStyle = hex(T.text)
      ctx.font = `52px ${SANS}`
      ctx.textAlign = 'center'
      centerBlock(ctx, p.caption, W / 2, H - 95, W - 240, 64, 2)
    }
    return
  }
  const base = p.images?.[0]
  cover(ctx, base, 0, 0, W, H)
  const g = ctx.createLinearGradient(0, 0, W, H)
  g.addColorStop(0, `${hex(T.bg)}f2`)
  g.addColorStop(1, `${hex(T.bg2)}cc`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  ctx.textAlign = 'center'
  ctx.fillStyle = hex(T.accent)
  ctx.fillRect(W / 2 - 90, 380, 180, 8)
  ctx.fillStyle = hex(T.text)
  ctx.font = `bold 120px ${SANS}`
  centerText(ctx, p.type === 'index' ? '감사합니다' : p.title, W / 2, 530, W - 360, 140, 2)
  ctx.fillStyle = hex(T.sub)
  ctx.font = `44px ${SANS}`
  centerText(ctx, p.type === 'index' ? `제주픽으로 만든 미니앨범 · ${p.date}` : p.subtitle, W / 2, 690, W - 500, 58, 2)
  if (p.type === 'cover') { ctx.font = `30px ${SANS}`; ctx.fillText('제주픽 미니앨범', W / 2, H - 100) }
}

// ── 외부에서 쓰는 함수 ──────────────────────────────────────
const STYLE = { polaroid: drawPolaroid, film: drawFilm, scrap: drawScrap, gallery: drawGallery }

// 앨범 전체 페이지(표지 + 사진들 + 마무리)를 그려 data URL 배열로 돌려준다
// template: { id, kind: 'polaroid'|'film'|'scrap'|'gallery'|'cinema', ...색 }
export async function renderAlbumPages({ template, title, subtitle, items }) {
  const ims = await Promise.all(items.map((it) => loadImg(it.dataUrl)))
  const date = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const total = items.length
  const draw = (page) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, W, H)
    ctx.shadowColor = 'transparent'
    ctx.setLineDash([])
    if (template.kind === 'cinema') drawCinema(ctx, page, template)
    else STYLE[template.kind](ctx, page)
    return canvas.toDataURL('image/jpeg', 0.88)
  }
  const common = { title, subtitle, date, total, images: ims.filter(Boolean) }
  const pages = [{ ...common, type: 'cover' }, ...items.map((it, i) => ({ ...common, type: 'photo', im: ims[i], caption: it.caption, index: i })), { ...common, type: 'index' }]
  const out = []
  for (const pg of pages) {
    out.push({ dataUrl: draw(pg), caption: pg.type === 'photo' ? pg.caption : pg.type === 'cover' ? title : '' })
    await new Promise((r) => setTimeout(r, 0)) // 화면이 멈추지 않게 한 장마다 숨 돌리기
  }
  return out
}
