// 미니앨범 도구 — 사진 줄이기(브라우저에서만 처리)와 PPTX 만들기. 사진은 서버나 Supabase 에 저장하지 않는다.

// 미니앨범 템플릿 — 사진 색을 분석해 자동으로 추천하고, 사용자가 바꿀 수도 있다
export const ALBUM_TEMPLATES = {
  classic: { label: '클래식', desc: '차분한 어두운 배경', bg: '0F1A20', bg2: '1B2A33', bar: '000000', barAlpha: 35, accent: '93C5FD', text: 'FFFFFF', sub: 'BFD3DA' },
  sunset: { label: '노을', desc: '따뜻한 주황빛', bg: '2B1308', bg2: '7C2D12', bar: '3B1D0A', barAlpha: 25, accent: 'FBBF24', text: 'FFF7ED', sub: 'FDE68A' },
  ocean: { label: '바다', desc: '시원한 파란빛', bg: '0B2545', bg2: '13538A', bar: '0B2545', barAlpha: 25, accent: '7DD3FC', text: 'FFFFFF', sub: 'BAE6FD' },
  forest: { label: '숲', desc: '싱그러운 초록빛', bg: '0F2A1D', bg2: '1F6B45', bar: '0F2A1D', barAlpha: 25, accent: '86EFAC', text: 'F0FDF4', sub: 'BBF7D0' },
}

const loadImg = (src) => new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.src = src })

// 사진들의 색을 보고 템플릿 추천: 따뜻한 색 → 노을, 파란색 → 바다, 초록색 → 숲, 그 밖 → 클래식
export async function recommendTemplate(dataUrls) {
  const votes = { classic: 0, sunset: 0, ocean: 0, forest: 0 }
  for (const url of dataUrls) {
    try {
      const im = await loadImg(url)
      const c = document.createElement('canvas')
      c.width = 24
      c.height = 24
      const x = c.getContext('2d', { willReadFrequently: true })
      x.drawImage(im, 0, 0, 24, 24)
      const d = x.getImageData(0, 0, 24, 24).data
      let r = 0, g = 0, b = 0
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2] }
      const n = d.length / 4
      r /= n; g /= n; b /= n
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      const sat = max === 0 ? 0 : (max - min) / max
      let hue = 0
      if (max !== min) {
        if (max === r) hue = ((g - b) / (max - min)) * 60
        else if (max === g) hue = (2 + (b - r) / (max - min)) * 60
        else hue = (4 + (r - g) / (max - min)) * 60
        if (hue < 0) hue += 360
      }
      if (sat < 0.12) votes.classic += 1
      else if (hue <= 55 || hue >= 330) votes.sunset += 1
      else if (hue >= 80 && hue <= 165) votes.forest += 1
      else if (hue >= 170 && hue <= 260) votes.ocean += 1
      else votes.classic += 1
    } catch { votes.classic += 0.5 }
  }
  return Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0]
}

// 사진 파일 → 긴 변을 maxEdge 로 줄인 JPEG data URL (EXIF 회전 적용, 위치 정보 등 메타데이터는 남지 않는다)
export async function shrinkImage(file, maxEdge = 1600, quality = 0.82) {
  let bmp
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error(`"${file.name}" 은(는) 이 브라우저에서 열 수 없는 사진이에요 (JPG·PNG·WebP 를 써 주세요)`)
  }
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * scale))
  const h = Math.max(1, Math.round(bmp.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff' // 투명 PNG 는 흰 배경으로
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close?.()
  return { dataUrl: canvas.toDataURL('image/jpeg', quality), width: w, height: h }
}

// items: [{ dataUrl, width, height, caption }] → .pptx 파일을 내려받는다 (라이브러리는 이 버튼을 누를 때만 불러온다)
export async function downloadAlbumPptx({ title, subtitle, items, fileName, template = 'classic' }) {
  const T = ALBUM_TEMPLATES[template] ?? ALBUM_TEMPLATES.classic
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 inch
  pptx.title = title
  const W = 13.33
  const H = 7.5
  const FONT = 'Malgun Gothic'
  const cover = (slide, it) => slide.addImage({ data: it.dataUrl, x: 0, y: 0, w: it.width / 96, h: it.height / 96, sizing: { type: 'cover', w: W, h: H } })

  // 표지: 첫 사진을 어둡게 깔고 제목을 올린다
  const s0 = pptx.addSlide()
  s0.background = { color: T.bg }
  if (items[0]) cover(s0, items[0])
  s0.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: H, fill: { color: T.bg, transparency: 35 }, line: { color: T.bg, transparency: 100 } })
  s0.addShape(pptx.ShapeType.rect, { x: W / 2 - 1.2, y: 2.25, w: 2.4, h: 0.06, fill: { color: T.accent }, line: { color: T.accent, transparency: 100 } })
  s0.addText(title, { x: 0.8, y: 2.5, w: W - 1.6, h: 1.4, fontFace: FONT, fontSize: 48, bold: true, color: T.text, align: 'center' })
  if (subtitle) s0.addText(subtitle, { x: 0.8, y: 4.0, w: W - 1.6, h: 0.8, fontFace: FONT, fontSize: 22, color: T.sub, align: 'center' })
  s0.addText('제주픽 미니앨범', { x: 0.8, y: H - 1.0, w: W - 1.6, h: 0.5, fontFace: FONT, fontSize: 14, color: T.sub, align: 'center' })

  // 사진 슬라이드: 사진을 가득 채우고 아래에 문구
  items.forEach((it) => {
    const s = pptx.addSlide()
    s.background = { color: '000000' }
    cover(s, it)
    if (it.caption) {
      s.addShape(pptx.ShapeType.rect, { x: 0, y: H - 1.25, w: W, h: 1.25, fill: { color: T.bar, transparency: T.barAlpha }, line: { color: T.bar, transparency: 100 } })
      s.addShape(pptx.ShapeType.rect, { x: 0, y: H - 1.25, w: W, h: 0.05, fill: { color: T.accent }, line: { color: T.accent, transparency: 100 } })
      s.addText(it.caption, { x: 0.6, y: H - 1.2, w: W - 1.2, h: 1.15, fontFace: FONT, fontSize: 26, color: T.text, align: 'center', valign: 'middle' })
    }
  })

  // 마지막 장
  const se = pptx.addSlide()
  se.background = { color: T.bg }
  se.addText('감사합니다', { x: 0.8, y: 2.8, w: W - 1.6, h: 1.0, fontFace: FONT, fontSize: 40, bold: true, color: T.text, align: 'center' })
  se.addText(`제주픽으로 만든 미니앨범 · ${new Date().toLocaleDateString('ko-KR')}`, { x: 0.8, y: 4.0, w: W - 1.6, h: 0.6, fontFace: FONT, fontSize: 16, color: T.sub, align: 'center' })

  await pptx.writeFile({ fileName: fileName || '제주-미니앨범.pptx' })
}
