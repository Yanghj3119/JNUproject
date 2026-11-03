// 미니앨범 → 짧은 MP4 영상 (휴대폰 갤러리에서 바로 재생). 브라우저 안에서만 만들고 서버로 보내지 않는다.
// 이미 그려 둔 앨범 페이지 그림을 장면 전환(페이드)과 천천히 확대하는 효과로 이어 붙이고, WebCodecs(H.264) + mp4-muxer 로 저장한다.
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'

const loadImg = (src) => new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = reject; im.src = src })
const tick = () => new Promise((r) => setTimeout(r, 0))

export const canMakeVideo = () => typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'

// pages: [{ dataUrl }] / 반환: MP4 Blob
export async function makeAlbumVideo({ pages, onProgress, width = 1280, height = 720, fps = 30, stepMs = 2200, fadeMs = 600 }) {
  if (!canMakeVideo()) throw new Error('이 브라우저는 영상 만들기를 지원하지 않아요. 최신 크롬·엣지·사파리에서 시도해 주세요')
  const config = { codec: 'avc1.4d0028', width, height, bitrate: 2_500_000, framerate: fps }
  const sup = await VideoEncoder.isConfigSupported(config).catch(() => null)
  if (!sup?.supported) throw new Error('이 기기는 MP4(H.264) 영상 만들기를 지원하지 않아요. PPT로 내려받아 주세요')

  const imgs = await Promise.all(pages.map((p) => loadImg(p.dataUrl)))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: 'avc', width, height }, fastStart: 'in-memory' })
  let failed = null
  const encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { failed = e } })
  encoder.configure(config)

  // 페이지 i 를 local(ms) 시점의 모습으로 그린다: 천천히 커지는 효과
  const draw = (i, local, alpha) => {
    const s = 1 + 0.045 * Math.min(1, local / (stepMs + fadeMs))
    const dw = width * s
    const dh = height * s
    ctx.globalAlpha = alpha
    ctx.drawImage(imgs[i], (width - dw) / 2, (height - dh) / 2, dw, dh)
    ctx.globalAlpha = 1
  }

  const n = imgs.length
  const total = n * stepMs + 400 // 마지막 장면을 조금 더 보여 준다
  const frames = Math.ceil((total / 1000) * fps)
  for (let f = 0; f < frames; f += 1) {
    if (failed) throw failed
    const t = (f / fps) * 1000
    const i = Math.min(n - 1, Math.floor(t / stepMs))
    const local = t - i * stepMs
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)
    if (i > 0 && local < fadeMs) {
      draw(i - 1, local + stepMs, 1)
      draw(i, local, local / fadeMs)
    } else draw(i, local, 1)
    const frame = new VideoFrame(canvas, { timestamp: Math.round((f * 1e6) / fps) })
    encoder.encode(frame, { keyFrame: f % fps === 0 })
    frame.close()
    while (encoder.encodeQueueSize > 8) await tick()
    if (f % 10 === 0) { onProgress?.(f / frames); await tick() }
  }
  await encoder.flush()
  if (failed) throw failed
  encoder.close()
  muxer.finalize()
  onProgress?.(1)
  return new Blob([muxer.target.buffer], { type: 'video/mp4' })
}

export function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
