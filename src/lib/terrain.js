// 제주 실제 지형 데이터 로더 — 키 없이 쓰는 무료 타일
//  · 고도: AWS Terrain Tiles (Terrarium PNG, Mapzen/SRTM 등)      — z11, 픽셀 RGB 로 고도 인코딩
//  · 위성사진: Sentinel-2 cloudless 2020 (EOX, CC BY-NC-SA 4.0)    — z12, 출처 표기 필수·비영리
// 두 타일 모두 같은 웹 메르카토르 격자라서 같은 영역에 그대로 겹친다.

const PI = Math.PI
const Z_ELEV = 11
const Z_IMG = 12
const STRIDE = 4 // 고도 픽셀 4칸마다 1 정점 (메쉬 크기 조절)
const UNIT = 10000 // 월드 1 단위 = 10km

// 제주 본섬 + 우도·가파도·마라도가 들어오는 범위
const B = { latMin: 33.08, latMax: 33.62, lngMin: 126.08, lngMax: 127.02 }

const ELEV_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`
const IMG_URL = (z, x, y) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/${z}/${y}/${x}.jpg`

const tileX = (lng, z) => ((lng + 180) / 360) * 2 ** z
const tileY = (lat, z) => {
  const r = (lat * PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / PI) / 2) * 2 ** z
}

const loadImage = (url) => new Promise((resolve, reject) => {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => resolve(img)
  img.onerror = () => reject(new Error(url))
  img.src = url
})

const makeCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h })

// 진행률을 여러 화면이 공유 (한 번만 불러오고 캐시)
let cache = null
let progress = 0
const subs = new Set()
const setProgress = (p) => { progress = p; subs.forEach((fn) => fn(p)) }

export function loadTerrain(onProgress) {
  if (onProgress) { subs.add(onProgress); onProgress(progress) }
  cache ??= build().catch((e) => { cache = null; throw e })
  return cache.finally(() => onProgress && subs.delete(onProgress))
}

async function build() {
  const x0 = Math.floor(tileX(B.lngMin, Z_ELEV)), x1 = Math.floor(tileX(B.lngMax, Z_ELEV))
  const y0 = Math.floor(tileY(B.latMax, Z_ELEV)), y1 = Math.floor(tileY(B.latMin, Z_ELEV))
  const nx = x1 - x0 + 1, ny = y1 - y0 + 1
  // 먼저 저해상도(z11)로 바로 보여 주고, 고해상도(z12)는 loadDetail() 로 나중에 받아 교체한다
  const elevCanvas = makeCanvas(nx * 256, ny * 256)
  const imgCanvas = makeCanvas(nx * 256, ny * 256)
  const ectx = elevCanvas.getContext('2d', { willReadFrequently: true })
  const ictx = imgCanvas.getContext('2d')

  const total = nx * ny * 2
  let done = 0, imgMissing = 0
  const tick = () => setProgress(++done / total)
  const jobs = []

  for (let ty = 0; ty < ny; ty++) for (let tx = 0; tx < nx; tx++) {
    jobs.push(loadImage(ELEV_URL(Z_ELEV, x0 + tx, y0 + ty)).then((img) => ectx.drawImage(img, tx * 256, ty * 256)).catch(() => {}).finally(tick))
    jobs.push(loadImage(IMG_URL(Z_ELEV, x0 + tx, y0 + ty)).then((img) => ictx.drawImage(img, tx * 256, ty * 256)).catch(() => { imgMissing++ }).finally(tick))
  }
  await Promise.all(jobs)
  if (imgMissing > (nx * ny) / 2) throw new Error('위성사진 타일을 불러오지 못했어요')

  // 고해상도 위성사진 (z12) — 성공하면 합성 캔버스, 실패하면 null
  let detail = null
  const loadDetail = () => (detail ??= (async () => {
    const f = 2 ** (Z_IMG - Z_ELEV)
    const canvas = makeCanvas(nx * 256 * f, ny * 256 * f)
    const ctx = canvas.getContext('2d')
    let missing = 0
    const all = []
    for (let ty = 0; ty < ny * f; ty++) for (let tx = 0; tx < nx * f; tx++) {
      all.push(loadImage(IMG_URL(Z_IMG, x0 * f + tx, y0 * f + ty)).then((img) => ctx.drawImage(img, tx * 256, ty * 256)).catch(() => { missing++ }))
    }
    await Promise.all(all)
    return missing > all.length * 0.1 ? null : canvas // 빠진 타일이 많으면 저해상도를 그대로 사용
  })().catch(() => null))

  // ── 고도 디코딩: Terrarium → 미터 (R·256 + G + B/256 − 32768) ──
  const W = nx * 256, H = ny * 256
  const px = ectx.getImageData(0, 0, W, H).data
  const gw = Math.floor(W / STRIDE), gh = Math.floor(H / STRIDE)
  let data = new Float32Array(gw * gh)
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const k = (j * STRIDE * W + i * STRIDE) * 4
    const h = px[k + 3] === 0 ? 0 : px[k] * 256 + px[k + 1] + px[k + 2] / 256 - 32768
    data[j * gw + i] = h < 1 ? 0 : h // 바다(수심)는 평평한 해수면으로
  }
  // 계단 현상을 줄이는 가벼운 3x3 평활화
  const smooth = new Float32Array(data.length)
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    let s = 0, c = 0
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const jj = j + dj, ii = i + di
      if (jj >= 0 && jj < gh && ii >= 0 && ii < gw) { s += data[jj * gw + ii]; c++ }
    }
    smooth[j * gw + i] = s / c
  }
  data = smooth

  // ── 좌표 변환: 위경도 → 월드(x, z). 영역 중심이 원점, 1 단위 = 10km, 북쪽이 −z ──
  const mpp = (156543.03392 * Math.cos((((B.latMin + B.latMax) / 2) * PI) / 180)) / 2 ** Z_ELEV // z11 한 픽셀의 미터
  const cx = (x0 + nx / 2) * 256, cy = (y0 + ny / 2) * 256
  const project = (lat, lng) => [
    ((tileX(lng, Z_ELEV) * 256 - cx) * mpp) / UNIT,
    ((tileY(lat, Z_ELEV) * 256 - cy) * mpp) / UNIT,
  ]
  const size = [(W * mpp) / UNIT, (H * mpp) / UNIT]

  // 월드 (x, z) 의 고도(m) — 이중선형 보간
  const heightAt = (x, z) => {
    const u = Math.min(Math.max((x / size[0] + 0.5) * (gw - 1), 0), gw - 1)
    const v = Math.min(Math.max((z / size[1] + 0.5) * (gh - 1), 0), gh - 1)
    const i = Math.min(Math.floor(u), gw - 2), j = Math.min(Math.floor(v), gh - 2)
    const fu = u - i, fv = v - j
    const a = data[j * gw + i], b = data[j * gw + i + 1], c = data[(j + 1) * gw + i], d = data[(j + 1) * gw + i + 1]
    return a * (1 - fu) * (1 - fv) + b * fu * (1 - fv) + c * (1 - fu) * fv + d * fu * fv
  }

  // 위성사진 왼쪽 위(북서쪽 바다) 평균 색 → 지형 바깥 바다 색
  const s = ictx.getImageData(0, 0, 24, 24).data
  let r = 0, g = 0, b = 0
  for (let k = 0; k < s.length; k += 4) { r += s[k]; g += s[k + 1]; b += s[k + 2] }
  const n = s.length / 4

  return {
    grid: { data, gw, gh, size },
    imageCanvas: imgCanvas,
    loadDetail,
    size, project, heightAt, UNIT,
    seaColor: `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`,
  }
}
