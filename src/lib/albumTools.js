// 미니앨범 도구 — 사진 줄이기(브라우저에서만 처리)와 PPTX 만들기. 사진은 서버나 Supabase 에 저장하지 않는다.

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
export async function downloadAlbumPptx({ title, subtitle, items, fileName }) {
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
  s0.background = { color: '0F1A20' }
  if (items[0]) cover(s0, items[0])
  s0.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: W, h: H, fill: { color: '000000', transparency: 45 }, line: { color: '000000', transparency: 100 } })
  s0.addText(title, { x: 0.8, y: 2.5, w: W - 1.6, h: 1.4, fontFace: FONT, fontSize: 48, bold: true, color: 'FFFFFF', align: 'center' })
  if (subtitle) s0.addText(subtitle, { x: 0.8, y: 4.0, w: W - 1.6, h: 0.8, fontFace: FONT, fontSize: 22, color: 'E6F1F5', align: 'center' })
  s0.addText('제주픽 미니앨범', { x: 0.8, y: H - 1.0, w: W - 1.6, h: 0.5, fontFace: FONT, fontSize: 14, color: 'BFD3DA', align: 'center' })

  // 사진 슬라이드: 사진을 가득 채우고 아래에 문구
  items.forEach((it) => {
    const s = pptx.addSlide()
    s.background = { color: '000000' }
    cover(s, it)
    if (it.caption) {
      s.addShape(pptx.ShapeType.rect, { x: 0, y: H - 1.25, w: W, h: 1.25, fill: { color: '000000', transparency: 35 }, line: { color: '000000', transparency: 100 } })
      s.addText(it.caption, { x: 0.6, y: H - 1.2, w: W - 1.2, h: 1.15, fontFace: FONT, fontSize: 26, color: 'FFFFFF', align: 'center', valign: 'middle' })
    }
  })

  // 마지막 장
  const se = pptx.addSlide()
  se.background = { color: '0F1A20' }
  se.addText('감사합니다', { x: 0.8, y: 2.8, w: W - 1.6, h: 1.0, fontFace: FONT, fontSize: 40, bold: true, color: 'FFFFFF', align: 'center' })
  se.addText(`제주픽으로 만든 미니앨범 · ${new Date().toLocaleDateString('ko-KR')}`, { x: 0.8, y: 4.0, w: W - 1.6, h: 0.6, fontFace: FONT, fontSize: 16, color: 'BFD3DA', align: 'center' })

  await pptx.writeFile({ fileName: fileName || '제주-미니앨범.pptx' })
}
