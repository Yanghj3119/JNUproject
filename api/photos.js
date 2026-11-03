import { searchPhotosInfo, debugPhotos } from '../server/photos.js'

// /api/photos?keyword=&rows=  (&debug=1 → 원본 응답 점검)
// 정상 결과는 6시간 CDN 캐시(공공데이터 일일 호출 한도 절약). 관광사진 API 가 실패해 일부만 받은 결과는 캐시하지 않는다.
export default async function handler(req, res) {
  try {
    const { keyword, rows, debug } = req.query ?? {}
    if (debug) return res.status(200).json(await debugPhotos({ keyword: keyword || '제주' }))
    const { list, degraded } = await searchPhotosInfo({ keyword, rows })
    res.setHeader('Cache-Control', degraded ? 'no-store' : 's-maxage=21600, stale-while-revalidate=86400')
    res.status(200).json(list)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
