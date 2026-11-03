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

// 사진 파일에서 촬영 날짜와 위치(GPS)를 읽는다 — 브라우저 안에서만 쓰고, 줄인 사진에는 남지 않는다. 없으면 빈 값.
export async function readPhotoMeta(file) {
  try {
    const exifr = (await import('exifr')).default
    const [d, gps] = await Promise.all([
      exifr.parse(file, { pick: ['DateTimeOriginal', 'CreateDate'] }).catch(() => null),
      exifr.gps(file).catch(() => null),
    ])
    const dt = d?.DateTimeOriginal ?? d?.CreateDate
    const date = dt instanceof Date && !Number.isNaN(dt.getTime())
      ? `${dt.getFullYear()}.${String(dt.getMonth() + 1).padStart(2, '0')}.${String(dt.getDate()).padStart(2, '0')}`
      : ''
    const hasGps = Number.isFinite(gps?.latitude) && Number.isFinite(gps?.longitude)
    return { date, lat: hasGps ? gps.latitude : null, lng: hasGps ? gps.longitude : null }
  } catch { return { date: '', lat: null, lng: null } }
}

// 너무 어둡거나 초점이 흐린 사진을 가볍게 찾는다 (작은 그림으로 밝기와 가장자리 선명도를 계산)
export async function checkPhotoQuality(dataUrl) {
  try {
    const im = await loadImg(dataUrl)
    const w = 160
    const h = Math.max(1, Math.round((im.height / im.width) * w))
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const x = c.getContext('2d', { willReadFrequently: true })
    x.drawImage(im, 0, 0, w, h)
    const d = x.getImageData(0, 0, w, h).data
    const g = new Float32Array(w * h)
    let sum = 0
    for (let i = 0; i < w * h; i++) { g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; sum += g[i] }
    const mean = sum / (w * h)
    let m = 0, m2 = 0, n = 0
    for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) {
      const v = 4 * g[j * w + i] - g[j * w + i - 1] - g[j * w + i + 1] - g[(j - 1) * w + i] - g[(j + 1) * w + i]
      m += v; m2 += v * v; n++
    }
    const variance = m2 / n - (m / n) ** 2
    if (mean < 40) return '조금 어두워요. 밝은 사진으로 바꾸면 더 예뻐요'
    if (mean > 238) return '너무 밝게 찍혔어요'
    if (variance < 25) return '초점이 흐리게 찍힌 것 같아요'
    return ''
  } catch { return '' }
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
// 그림 그대로 들어가서 미리보기와 똑같이 보이고, 문구는 슬라이드 노트에도 넣어 둔다.
// 슬라이드쇼를 시작하면 장당 advanceMs(기본 1.5초) 뒤에 부드러운 페이드로 자동으로 넘어간다. (라이브러리는 이 버튼을 누를 때만 불러온다)
export async function downloadAlbumPptx({ title, pages, fileName, advanceMs = 1500 }) {
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
  const name = fileName || '제주-미니앨범.pptx'
  let blob = null
  try {
    // 만들어진 파일의 슬라이드 XML 에 전환(<p:transition>)을 끼워 넣는다 — 실패하면 설정 없는 일반 파일로 내려받는다
    const { default: JSZip } = await import('jszip')
    const buf = await pptx.write({ outputType: 'arraybuffer' })
    const zip = await JSZip.loadAsync(buf)
    const tr = `<p:transition spd="med" advClick="1" advTm="${advanceMs}"><p:fade/></p:transition>`
    let patched = 0
    for (const path of Object.keys(zip.files)) {
      if (!/^ppt\/slides\/slide\d+\.xml$/.test(path)) continue
      const xml = await zip.file(path).async('string')
      if (xml.includes('<p:transition') || !xml.includes('</p:clrMapOvr>')) continue
      zip.file(path, xml.replace('</p:clrMapOvr>', `</p:clrMapOvr>${tr}`))
      patched += 1
    }
    if (patched) blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' })
  } catch { blob = null }
  if (!blob) { await pptx.writeFile({ fileName: name }); return }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
