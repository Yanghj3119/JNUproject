// api/*.js 공통 껍데기: 쿼리를 함수에 넘기고, 결과를 JSON 으로 응답
// ttl(초) 동안 CDN 캐시 → 공공데이터 일일 호출량 절약
export function route(fn, { ttl = 0 } = {}) {
  return async function handler(req, res) {
    try {
      const data = await fn(req.query ?? {})
      if (ttl) res.setHeader('Cache-Control', `s-maxage=${ttl}, stale-while-revalidate=${ttl * 4}`)
      res.status(200).json(data)
    } catch (e) {
      res.status(500).json({ error: e.message })
    }
  }
}
