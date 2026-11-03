// 미니앨범 도구 — 사진 줄이기(브라우저에서만 처리), 템플릿, PPT 내려받기. 사진은 서버나 Supabase 에 저장하지 않는다.

// 미니앨범 템플릿 — 앨범형 4가지(소장용 사진첩 느낌)와 시네마틱 4가지(사진을 가득 채움)
//  · 사진 색을 분석해 자동으로 추천하고, 사용자가 직접 바꿀 수도 있다
export const ALBUM_TEMPLATES = {
  polaroid: { kind: 'polaroid', group: 'album', label: '폴라로이드', desc: '크림색 종이에 폴라로이드 사진과 마스킹테이프', swatch: '#f0e4c8' },
  film: { kind: 'film', group: 'album', label: '필름', desc: '필름 현상본 느낌의 어두운 컷 사진', swatch: '#1b1b1e' },
  scrap: { kind: 'scrap', group: 'album', label: '스크랩북', desc: '크라프트지에 붙인 사진과 손글씨 라벨', swatch: '#c9a272' },
  gallery: { kind: 'gallery', group: 'album', label: '갤러리 액자', desc: '전시장 벽에 걸린 액자와 작품 설명판', swatch: '#e6e3da' },
  sunset: { kind: 'cinema', group: 'cinema', label: '노을', desc: '사진을 가득 채운 따뜻한 주황빛', swatch: '#F59E0B', bg: '2B1308', bg2: '7C2D12', bar: '3B1D0A', accent: 'FBBF24', text: 'FFF7ED', sub: 'FDE68A' },
  ocean: { kind: 'cinema', group: 'cinema', label: '바다', desc: '사진을 가득 채운 시원한 파란빛', swatch: '#38BDF8', bg: '0B2545', bg2: '13538A', bar: '0B2545', accent: '7DD3FC', text: 'FFFFFF', sub: 'BAE6FD' },
  forest: { kind: 'cinema', group: 'cinema', label: '숲', desc: '사진을 가득 채운 싱그러운 초록빛', swatch: '#4ADE80', bg: '0F2A1D', bg2: '1F6B45', bar: '0F2A1D', accent: '86EFAC', text: 'F0FDF4', sub: 'BBF7D0' },
  classic: { kind: 'cinema', group: 'cinema', label: '클래식', desc: '사진을 가득 채운 차분한 어두운 배경', swatch: '#93C5FD', bg: '0F1A20', bg2: '1B2A33', bar: '000000', accent: '93C5FD', text: 'FFFFFF', sub: 'BFD3DA' },
}
export const templateOf = (id) => ({ id, ...(ALBUM_TEMPLATES[id] ?? ALBUM_TEMPLATES.polaroid) })

// 사진의 색감 → 어울리는 앨범형 템플릿 (소장용 앨범 느낌을 기본으로 추천한다)
const BY_MOOD = { sunset: 'polaroid', ocean: 'gallery', forest: 'scrap', classic: 'film' }
export const templateForMood = (mood) => BY_MOOD[mood] ?? 'polaroid'

const loadImg = (src) => new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.src = src })

// 사진들의 색을 보고 템플릿 추천: 따뜻한 색 → 폴라로이드, 파란색 → 갤러리 액자, 초록색 → 스크랩북, 그 밖 → 필름
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
  return templateForMood(Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0])
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

// pages: renderAlbumPages 결과([{ dataUrl, caption }]) → 한 장씩 슬라이드로 넣은 .pptx 를 내려받는다
// 그림 그대로 들어가서 미리보기와 똑같이 보이고, 문구는 슬라이드 노트에도 넣어 둔다. (라이브러리는 이 버튼을 누를 때만 불러온다)
export async function downloadAlbumPptx({ title, pages, fileName }) {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 inch
  pptx.title = title
  pages.forEach((pg) => {
    const s = pptx.addSlide()
    s.background = { color: '000000' }
    s.addImage({ data: pg.dataUrl, x: 0, y: 0, w: 13.33, h: 7.5 })
    if (pg.caption) s.addNotes(pg.caption)
  })
  await pptx.writeFile({ fileName: fileName || '제주-미니앨범.pptx' })
}
