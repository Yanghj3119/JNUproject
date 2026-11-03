// 미니앨범 페이지 그리기 — 템플릿마다 1920x1080 한 장씩 캔버스에 그린다.
// 사진은 자르지 않고 비율 그대로 넣고(세로 사진은 액자 모양을 바꾸거나 두 장을 한 페이지에), 미리보기와 PPT 가 같은 그림을 쓴다.
// 모두 이 브라우저 안에서만 처리된다.
export const W = 1920
export const H = 1080

// 글꼴: 웹폰트를 먼저 불러 와서 어느 기기에서 만들어도 같은 모양이 나오게 한다 (실패하면 시스템 글꼴로 대신한다)
const SERIF = '"Nanum Myeongjo", "Batang", "AppleMyungjo", "Noto Serif KR", serif'
const HAND = '"Nanum Pen Script", "Nanum Myeongjo", "Batang", "AppleMyungjo", serif'
const SANS = '"Pretendard Variable", "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
const MONO = '"Consolas", "Menlo", "Courier New", monospace'
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700&family=Nanum+Pen+Script&display=swap'

let fontLink = null
async function ensureFonts(texts) {
  if (typeof document === 'undefined') return
  if (!fontLink) {
    fontLink = new Promise((resolve) => {
      const l = document.createElement('link')
      l.rel = 'stylesheet'
      l.href = FONT_CSS
      l.onload = resolve
      l.onerror = resolve
      document.head.appendChild(l)
      setTimeout(resolve, 5000)
    })
  }
  await fontLink
  const sample = [...new Set(texts.join('') + '0123456789.-·/')].join('')
  const faces = ['400 40px "Nanum Myeongjo"', '700 40px "Nanum Myeongjo"', '400 40px "Nanum Pen Script"', '400 40px "Pretendard Variable"', '700 40px "Pretendard Variable"']
  await Promise.all(faces.map((f) => document.fonts.load(f, sample).catch(() => null)))
}

const loadImg = (src) => new Promise((resolve) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = src })
const pad2 = (n) => String(n).padStart(2, '0')
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 } }

// 사진을 자르지 않고 maxW x maxH 안에 비율 그대로 맞춘 크기
function fit(im, maxW, maxH) {
  if (!im) return { w: maxW, h: maxH }
  const r = Math.min(maxW / im.width, maxH / im.height)
  return { w: Math.round(im.width * r), h: Math.round(im.height * r) }
}
const portrait = (im) => Boolean(im) && im.height / im.width > 1.12
// 칸 전체를 채워야 할 때(필름 컷·시네마틱): 사진을 흐리게 깔고 그 위에 사진 전체를 올린다
function coverBlur(ctx, im, x, y, w, h) {
  ctx.save()
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip()
  if (im) {
    const r = Math.max(w / im.width, h / im.height)
    const sw = w / r
    const sh = h / r
    try { ctx.filter = 'blur(28px) brightness(0.7)' } catch { /* 필터를 못 쓰는 브라우저 */ }
    ctx.drawImage(im, (im.width - sw) / 2, (im.height - sh) / 2, sw, sh, x - 40, y - 40, w + 80, h + 80)
    ctx.filter = 'none'
  } else { ctx.fillStyle = '#222'; ctx.fillRect(x, y, w, h) }
  ctx.restore()
  const f = fit(im, w, h)
  if (im) ctx.drawImage(im, x + (w - f.w) / 2, y + (h - f.h) / 2, f.w, f.h)
  return f
}

// 글자를 maxW 안에서 줄바꿈 (글자 단위)
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
// 글 덩어리의 세로 가운데가 cy 가 되게 그린다
function centerBlock(ctx, text, cx, cy, maxW, lineH, maxLines = 2) {
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  const lines = wrap(ctx, text, maxW, maxLines)
  const y0 = cy - ((lines.length - 1) * lineH) / 2
  lines.forEach((l, i) => ctx.fillText(l, cx, y0 + i * lineH))
  return lines.length
}
function leftBlock(ctx, text, x, y, maxW, lineH, maxLines = 3) {
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  wrap(ctx, text, maxW, maxLines).forEach((l, i) => ctx.fillText(l, x, y + i * lineH))
}

// 종이 바탕 + 은은한 결
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

// 페이지 아래의 한 줄 정보 (장소 · 날짜)
const infoOf = (it, date) => [it?.place, it?.date || date].filter(Boolean).join('  ·  ')

// 페이지 아래 작은 안내: 왼쪽 번호, 오른쪽 장소·날짜
function footer(ctx, p, color) {
  ctx.fillStyle = color
  ctx.globalAlpha = 0.65
  ctx.font = `28px ${MONO}`
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillText(`No. ${pad2(p.index + 1)}${p.type === 'pair' ? `-${pad2(p.index + 2)}` : ''} / ${pad2(p.total)}`, 130, H - 70)
  ctx.textAlign = 'right'
  ctx.fillText(p.info || p.date, W - 130, H - 70)
  ctx.globalAlpha = 1
}

// ── 폴라로이드 ────────────────────────────────────────────────
// 사진 비율대로 카드 크기가 정해진다 (사진 위쪽·옆 여백 pad, 아래쪽 글 영역 capH)
function polaroidCard(ctx, im, cx, cy, rot, maxW, maxH, pad, caption, capFont = 58, capH = 150) {
  const { w: pw, h: ph } = fit(im, maxW, maxH)
  const cw = pw + pad * 2
  const ch = ph + pad + capH
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  shadowOn(ctx, 45, 18, 0.35)
  ctx.fillStyle = '#fffdf8'
  ctx.fillRect(-cw / 2, -ch / 2, cw, ch)
  shadowOff(ctx)
  const px = -cw / 2 + pad
  const py = -ch / 2 + pad
  if (im) ctx.drawImage(im, px, py, pw, ph)
  ctx.strokeStyle = 'rgba(0,0,0,0.14)'
  ctx.lineWidth = 2
  ctx.strokeRect(px, py, pw, ph)
  if (caption) {
    ctx.fillStyle = '#3a2f22'
    ctx.font = `${capFont}px ${HAND}`
    centerBlock(ctx, caption, 0, py + ph + capH / 2, cw - pad * 2 - 20, capFont * 1.15, 2)
  }
  ctx.restore()
  return { cw, ch }
}

function drawPolaroid(ctx, p) {
  paper(ctx, '#f6efe0', '#e8dbc1', 0.06, 7)
  ctx.textBaseline = 'alphabetic'
  if (p.type === 'cover') {
    const [a, b] = p.images
    if (b) polaroidCard(ctx, b, 1480, 520, 0.1, 440, 520, 30, '', 36, 90)
    polaroidCard(ctx, a, 1330, 560, -0.07, 560, 600, 34, '', 36, 100)
    ctx.fillStyle = '#3a2f22'
    ctx.textAlign = 'left'
    ctx.font = `italic 34px ${SERIF}`
    ctx.fillText('— Jeju Photo Album —', 150, 330)
    ctx.font = `bold 92px ${SERIF}`
    const n = wrap(ctx, p.title, 780, 2)
    n.forEach((l, i) => ctx.fillText(l, 150, 450 + i * 112))
    ctx.font = `38px ${SERIF}`
    ctx.fillStyle = 'rgba(58,47,34,0.8)'
    leftBlock(ctx, p.subtitle, 150, 480 + n.length * 112, 780, 52, 3)
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
    const box = Math.min(300, (W - 240) / n - 40)
    p.images.forEach((im, i) => {
      const cx = W / 2 + (i - (n - 1) / 2) * (box + 60)
      polaroidCard(ctx, im, cx, 560 + (i % 2 ? 40 : -20), (i % 2 ? 1 : -1) * 0.04, box, box, 20, '', 30, 70)
      ctx.fillStyle = 'rgba(58,47,34,0.7)'
      ctx.font = `28px ${MONO}`
      ctx.textAlign = 'center'
      ctx.fillText(pad2(i + 1), cx, 560 + box / 2 + 120)
    })
    ctx.font = `32px ${SERIF}`
    ctx.fillStyle = 'rgba(58,47,34,0.75)'
    ctx.fillText(`${p.title}  ·  ${p.date}`, W / 2, H - 110)
    return
  }
  if (p.type === 'pair') {
    const [a, b] = p.items
    const ra = -0.04, rb = 0.035
    polaroidCard(ctx, p.ims[0], W / 2 - 330, H / 2 - 20, ra, 520, 620, 34, a.caption, 54, 140)
    polaroidCard(ctx, p.ims[1], W / 2 + 330, H / 2 - 10, rb, 520, 620, 34, b.caption, 54, 140)
    ctx.save(); ctx.translate(W / 2 - 330, H / 2 - 20); ctx.rotate(ra); tape(ctx, 0, -435, 170, 50, -0.3, 'rgba(250,215,120,0.78)'); ctx.restore()
    ctx.save(); ctx.translate(W / 2 + 330, H / 2 - 10); ctx.rotate(rb); tape(ctx, 0, -435, 170, 50, 0.3, 'rgba(250,215,120,0.78)'); ctx.restore()
    footer(ctx, p, '#3a2f22')
    return
  }
  const rot = (p.index % 2 ? 1 : -1) * 0.035
  const { ch } = polaroidCard(ctx, p.im, W / 2, H / 2 - 10, rot, 880, 640, 40, p.item.caption, 62, 170)
  ctx.save()
  ctx.translate(W / 2, H / 2 - 10)
  ctx.rotate(rot)
  tape(ctx, -260, -ch / 2, 190, 56, -0.35, 'rgba(250,215,120,0.78)')
  tape(ctx, 260, -ch / 2, 190, 56, 0.3, 'rgba(250,215,120,0.78)')
  ctx.restore()
  footer(ctx, p, '#3a2f22')
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
function filmCut(ctx, im, x, y, w, h) {
  ctx.fillStyle = '#000'
  ctx.fillRect(x - 12, y - 12, w + 24, h + 24)
  ctx.save()
  try { ctx.filter = 'sepia(0.2) contrast(1.05) saturate(1.1)' } catch { /* 필터를 못 쓰는 브라우저 */ }
  coverBlur(ctx, im, x, y, w, h)
  ctx.restore()
  const vg = ctx.createRadialGradient(x + w / 2, y + h / 2, h * 0.35, x + w / 2, y + h / 2, Math.max(w, h) * 0.7)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.3)')
  ctx.fillStyle = vg
  ctx.fillRect(x, y, w, h)
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
    p.images.slice(0, 3).forEach((im, i) => {
      const x = 330 + i * 430
      ctx.fillStyle = '#000'
      ctx.fillRect(x - 8, 640, 396, 290)
      coverBlur(ctx, im, x, 648, 380, 274)
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
    centerBlock(ctx, p.title, W / 2, 330, W - 400, 130, 2)
    ctx.fillStyle = 'rgba(255,255,255,0.78)'
    ctx.font = `40px ${SANS}`
    centerBlock(ctx, p.subtitle, W / 2, 500, W - 500, 54, 2)
    ctx.fillStyle = ORANGE
    ctx.font = `28px ${MONO}`
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(p.date, W / 2, 596)
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
      coverBlur(ctx, im, x, 308, cw, cw * 0.75)
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
  const labelY = 112 + 722 + 56
  if (p.type === 'pair') {
    const xs = [150, 1000]
    p.ims.forEach((im, i) => {
      filmCut(ctx, im, xs[i], 112, 770, 722)
      ctx.fillStyle = ORANGE
      ctx.font = `26px ${MONO}`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'alphabetic'
      ctx.fillText(`▶ ${p.index + i + 1}`, xs[i], labelY)
      if (p.items[i].caption) {
        ctx.fillStyle = '#fff'
        ctx.font = `36px ${SANS}`
        centerBlock(ctx, p.items[i].caption, xs[i] + 385, H - 128, 740, 46, 1)
      }
    })
    ctx.fillStyle = ORANGE
    ctx.font = `24px ${MONO}`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(p.info || 'JEJU 400', 1770, labelY)
    return
  }
  filmCut(ctx, p.im, 220, 112, 1480, 722)
  ctx.fillStyle = ORANGE
  ctx.font = `26px ${MONO}`
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillText(`▶ ${p.index + 1}`, 220, labelY)
  ctx.textAlign = 'right'
  ctx.fillText(`${p.info ? `${p.info}   ` : ''}${p.index + 1}A   JEJU 400`, 1700, labelY)
  if (p.item.caption) {
    ctx.fillStyle = '#fff'
    ctx.font = `42px ${SANS}`
    centerBlock(ctx, p.item.caption, W / 2, H - 128, 1480, 52, 1)
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
function stamp(ctx, cx, cy, date, place) {
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
  ctx.textBaseline = 'alphabetic'
  ctx.font = `bold ${place ? 24 : 30}px ${SANS}`
  ctx.fillText((place || 'JEJU').slice(0, 7), 0, -4)
  ctx.font = `20px ${MONO}`
  ctx.fillText(date, 0, 28)
  ctx.restore()
}
function whiteFrame(ctx, im, cx, cy, rot, maxW, maxH, border) {
  const { w, h } = fit(im, maxW, maxH)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(rot)
  shadowOn(ctx, 30, 12, 0.35)
  ctx.fillStyle = '#fffdf7'
  ctx.fillRect(-w / 2 - border, -h / 2 - border, w + border * 2, h + border * 2)
  shadowOff(ctx)
  if (im) ctx.drawImage(im, -w / 2, -h / 2, w, h)
  ctx.restore()
  return { w, h }
}
function label(ctx, cx, cy, rot, w, h, text, font = 58) {
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
  ctx.font = `${font}px ${HAND}`
  centerBlock(ctx, text, 0, 0, w - 70, font * 1.15, 2)
  ctx.restore()
}
const lastWord = (s) => (s ? String(s).split(' ').slice(-1)[0] : '')
function drawScrap(ctx, p) {
  paper(ctx, '#cfa977', '#b98d5a', 0.08, 11, true)
  ctx.textBaseline = 'alphabetic'
  if (p.type === 'cover') {
    const imgs = p.images.slice(0, 3)
    const pos = [[1330, 470, -0.07], [1560, 640, 0.08], [1180, 700, 0.03]]
    imgs.forEach((im, i) => whiteFrame(ctx, im, pos[i][0], pos[i][1], pos[i][2], 380, 300, 18))
    tape(ctx, 1330, 300, 170, 50, -0.3, 'rgba(244,114,182,0.7)')
    label(ctx, 560, 470, -0.03, 820, 360, p.title, 92)
    ctx.fillStyle = '#4a3320'
    ctx.font = `38px ${SERIF}`
    centerBlock(ctx, p.subtitle, 560, 760, 760, 48, 2)
    stamp(ctx, 220, 220, p.date, '')
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
      const cy = 560 + (i % 2 ? 50 : -30)
      const f = whiteFrame(ctx, im, cx, cy, (i % 2 ? 1 : -1) * 0.05, 270, 240, 14)
      tape(ctx, cx, cy - f.h / 2 - 20, 120, 38, (i % 2 ? 0.3 : -0.3), i % 2 ? 'rgba(45,212,191,0.7)' : 'rgba(244,114,182,0.7)')
    })
    stamp(ctx, W - 230, H - 190, p.date, '')
    scrapDecor(ctx, 9, [200, 300, 1700, 850])
    return
  }
  if (p.type === 'pair') {
    const rots = [-0.04, 0.035]
    p.ims.forEach((im, i) => {
      const cx = W / 2 + (i ? 330 : -330)
      const f = whiteFrame(ctx, im, cx, 450, rots[i], 520, 600, 24)
      tape(ctx, cx - 120, 450 - f.h / 2 - 24, 170, 50, -0.4, 'rgba(244,114,182,0.72)')
      tape(ctx, cx + 120, 450 - f.h / 2 - 24, 170, 50, 0.35, 'rgba(45,212,191,0.72)')
      if (p.items[i].caption) label(ctx, cx, 450 + f.h / 2 + 90, -rots[i] / 2, 520, 120, p.items[i].caption, 46)
    })
    stamp(ctx, 1740, 160, p.date, lastWord(p.items[0].place))
    footer(ctx, p, 'rgba(74,51,32,1)')
    scrapDecor(ctx, 30 + p.index, [200, 100, 1720, 960])
    return
  }
  const rot = (p.index % 2 ? 1 : -1) * 0.03
  const f = whiteFrame(ctx, p.im, 900, 480, rot, 1000, 640, 28)
  tape(ctx, 900 - f.w / 2 + 40, 480 - f.h / 2 - 30, 190, 54, -0.4, 'rgba(244,114,182,0.72)')
  tape(ctx, 900 + f.w / 2 - 40, 480 - f.h / 2 - 20, 190, 54, 0.35, 'rgba(45,212,191,0.72)')
  if (p.item.caption) label(ctx, 1200, 480 + f.h / 2 + 100, 0.025 * (p.index % 2 ? -1 : 1), 880, 150, p.item.caption, 62)
  stamp(ctx, 1700, 230, p.date, lastWord(p.item.place))
  footer(ctx, p, 'rgba(74,51,32,1)')
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
function frame(ctx, im, cx, cy, maxW, maxH, mat = 70) {
  const { w, h } = fit(im, maxW, maxH)
  const fw = w + mat * 2
  const fh = h + mat * 2
  ctx.save()
  shadowOn(ctx, 50, 26, 0.35)
  ctx.fillStyle = '#16120e'
  ctx.fillRect(cx - fw / 2 - 18, cy - fh / 2 - 18, fw + 36, fh + 36)
  shadowOff(ctx)
  ctx.fillStyle = '#fbfaf7'
  ctx.fillRect(cx - fw / 2, cy - fh / 2, fw, fh)
  if (im) ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h)
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'
  ctx.lineWidth = 2
  ctx.strokeRect(cx - w / 2, cy - h / 2, w, h)
  ctx.restore()
  return { w, h, fh }
}
function plaque(ctx, cx, cy, w, h, line1, line2, f1 = 34) {
  ctx.save()
  shadowOn(ctx, 16, 6, 0.25)
  ctx.fillStyle = '#fffefb'
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h)
  shadowOff(ctx)
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 2
  ctx.strokeRect(cx - w / 2 + 8, cy - h / 2 + 8, w - 16, h - 16)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#26211b'
  ctx.font = `bold ${f1}px ${SERIF}`
  const nl = Math.min(2, wrap(ctx, line1 || '', w - 70, 2).length)
  const blockH = nl * (f1 + 8) + (line2 ? 36 : 0)
  centerBlock(ctx, line1 || '', cx, cy - blockH / 2 + (nl * (f1 + 8)) / 2, w - 70, f1 + 8, 2)
  if (line2) {
    ctx.fillStyle = '#7a7266'
    ctx.font = `22px ${SERIF}`
    ctx.textBaseline = 'middle'
    ctx.fillText(line2, cx, cy - blockH / 2 + nl * (f1 + 8) + 18)
  }
  ctx.restore()
}
function drawGallery(ctx, p) {
  wall(ctx)
  ctx.textBaseline = 'alphabetic'
  if (p.type === 'cover') {
    const xs = [380, 960, 1540]
    p.images.slice(0, 3).forEach((im, i) => frame(ctx, im, xs[i], 360, 330, 250, 34))
    plaque(ctx, W / 2, 800, 900, 210, p.title, p.subtitle || p.date)
    ctx.fillStyle = '#7a7266'
    ctx.font = `24px ${SERIF}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText(`JEJU PHOTO EXHIBITION  ·  ${p.date}`, W / 2, 970)
    return
  }
  if (p.type === 'index') {
    const n = p.images.length
    p.images.forEach((im, i) => frame(ctx, im, W / 2 + (i - (n - 1) / 2) * 360, 470, 250, 220, 28))
    plaque(ctx, W / 2, 860, 760, 150, '전시를 마치며', `${p.title}  ·  ${p.date}`)
    return
  }
  if (p.type === 'pair') {
    p.ims.forEach((im, i) => {
      const cx = W / 2 + (i ? 470 : -470)
      const f = frame(ctx, im, cx, 400, 560, 560, 50)
      plaque(ctx, cx, 400 + f.fh / 2 + 110, 640, 130, p.items[i].caption || p.title, p.info || `Jeju · ${p.date}`, 30)
    })
    return
  }
  const f = frame(ctx, p.im, W / 2, 430, 1100, 600, 66)
  plaque(ctx, W / 2, 430 + f.fh / 2 + 92, 980, 120, p.item.caption || p.title, `${p.info || `Jeju  ·  ${p.date}`}  ·  ${p.index + 1}/${p.total}`)
}

// ── 미니멀(여백 많은 흰 종이/검은 종이) ─────────────────────────
function drawMinimal(ctx, p, T) {
  const paper = `#${T.paper}`, ink = `#${T.ink}`, sub = `#${T.sub}`
  ctx.fillStyle = paper
  ctx.fillRect(0, 0, W, H)
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'center'
  const rule = (cx, y, w = 80) => { ctx.fillStyle = sub; ctx.fillRect(cx - w / 2, y, w, 2) }
  const put = (im, cx, cy, mw, mh) => { const { w, h } = fit(im, mw, mh); if (im) ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h); return { w, h } }
  const note = (text, info, cx, w) => {
    if (text) { ctx.fillStyle = ink; ctx.font = `40px ${SERIF}`; centerBlock(ctx, text, cx, 872, w, 54, 2) }
    if (info) { ctx.fillStyle = sub; ctx.font = `24px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(info, cx, 1000) }
  }
  if (p.type === 'cover') {
    put(p.images[0], 560, 520, 800, 780)
    ctx.textAlign = 'left'
    ctx.fillStyle = sub; ctx.font = `24px ${SANS}`
    ctx.fillText('JEJU MINI ALBUM', 1060, 380)
    ctx.fillStyle = ink; ctx.font = `bold 72px ${SERIF}`
    const lines = wrap(ctx, p.title || "", 760, 3)
    lines.forEach((l, i) => ctx.fillText(l, 1060, 500 + i * 92))
    const y = 500 + lines.length * 92
    ctx.fillStyle = sub; ctx.fillRect(1060, y - 30, 80, 2)
    ctx.fillStyle = sub; ctx.font = `32px ${SERIF}`
    wrap(ctx, p.subtitle || '', 720, 3).forEach((l, i) => ctx.fillText(l, 1060, y + 30 + i * 46))
    ctx.font = `24px ${SANS}`
    ctx.fillText(p.date, 1060, 940)
    return
  }
  if (p.type === 'index') {
    const n = p.images.length
    p.images.forEach((im, i) => put(im, W / 2 + (i - (n - 1) / 2) * 300, 330, 260, 200))
    ctx.fillStyle = ink; ctx.font = `bold 68px ${SERIF}`
    centerBlock(ctx, p.title, W / 2, 640, W - 400, 84, 2)
    rule(W / 2, 760)
    ctx.fillStyle = sub; ctx.font = `26px ${SANS}`; ctx.textAlign = 'center'
    ctx.fillText(p.date, W / 2, 840)
    return
  }
  if (p.type === 'pair') {
    p.ims.forEach((im, i) => {
      const cx = W / 2 + (i ? 420 : -420)
      put(im, cx, 420, 700, 720)
      note(p.items[i].caption, '', cx, 700)
    })
    note('', p.info, W / 2, 0)
    return
  }
  put(p.im, W / 2, 440, 1560, 760)
  note(p.item.caption, `${p.info || p.date}  ·  ${p.index + 1} / ${p.total}`, W / 2, 1400)
}

// ── 외부에서 쓰는 함수 ──────────────────────────────────────
const STYLE = { polaroid: drawPolaroid, film: drawFilm, scrap: drawScrap, gallery: drawGallery }

// 앨범 전체 페이지(표지 + 사진 페이지들 + 마무리)를 그려 data URL 배열로 돌려준다
// items: [{ dataUrl, caption, place, date }] / template: { kind: 'polaroid'|'film'|'scrap'|'gallery'|'minimal', ...색 }
// 세로 사진이 연달아 두 장이면 한 페이지에 나란히 넣는다
export async function renderAlbumPages({ template, title, subtitle, items }) {
  await ensureFonts([title, subtitle, ...items.flatMap((it) => [it.caption, it.place, it.date])].map((x) => x ?? ''))
  const ims = await Promise.all(items.map((it) => loadImg(it.dataUrl)))
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '.').replace(/\.$/, '')
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
    ctx.globalAlpha = 1
    if (template.kind === 'minimal') drawMinimal(ctx, page, template)
    else STYLE[template.kind](ctx, page)
    return canvas.toDataURL('image/jpeg', 0.88)
  }
  const date = items.find((it) => it.date)?.date || today
  const common = { title, subtitle, date, total, images: ims.filter(Boolean) }

  const photoPages = []
  for (let i = 0; i < items.length; i += 1) {
    if (portrait(ims[i]) && i + 1 < items.length && portrait(ims[i + 1])) {
      photoPages.push({ ...common, type: 'pair', ims: [ims[i], ims[i + 1]], items: [items[i], items[i + 1]], index: i, info: infoOf(items[i], date) })
      i += 1
    } else photoPages.push({ ...common, type: 'photo', im: ims[i], item: items[i], index: i, info: infoOf(items[i], date) })
  }
  const pages = [{ ...common, type: 'cover' }, ...photoPages, { ...common, type: 'index' }]
  const out = []
  for (const pg of pages) {
    const cap = pg.type === 'photo' ? pg.item.caption : pg.type === 'pair' ? [pg.items[0].caption, pg.items[1].caption].filter(Boolean).join(' / ') : pg.type === 'cover' ? title : ''
    out.push({ dataUrl: draw(pg), caption: cap })
    await new Promise((r) => setTimeout(r, 0)) // 화면이 멈추지 않게 한 장마다 숨 돌리기
  }
  return out
}
