// 공공데이터포털 API 공통 호출 도구 (서버에서만 사용 — 인증키 보호)

export function serviceKey() {
  const k = process.env.DATA_GO_KR_KEY
  if (!k) throw new Error('DATA_GO_KR_KEY 가 없어요. .env.local 에 공공데이터포털 인증키(Decoding)를 넣어 주세요')
  return k.includes('%') ? decodeURIComponent(k) : k
}

// 한국관광공사 계열 API 공통 파라미터
export const tourParams = (extra = {}) => ({ MobileOS: 'ETC', MobileApp: 'JejuPick', _type: 'json', ...extra })

export async function callApi(url, params = {}) {
  const qs = new URLSearchParams({ serviceKey: serviceKey() })
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const r = await fetch(`${url}?${qs}`, { signal: AbortSignal.timeout(10000) })
  const text = await r.text()

  let data
  try { data = JSON.parse(text) } catch {
    if (/SERVICE[_ ]KEY/i.test(text)) throw new Error('인증키가 등록되지 않았거나 아직 승인 전이에요 (활용신청 후 1~2시간 걸릴 수 있어요)')
    if (/LIMITED_NUMBER/i.test(text)) throw new Error('일일 호출 한도를 초과했어요')
    throw new Error(`응답이 JSON이 아님 (${r.status}): ${text.slice(0, 140)}`)
  }
  // 인증 오류는 HTTP 403 + 다른 모양의 JSON 으로 온다 (response 가 없어서 지금까지 "빈 결과"로 오인됐음)
  const authErr = data?.OpenAPI_ServiceResponse?.cmmMsgHeader
  if (authErr) {
    const reason = authErr.returnAuthMsg || authErr.errMsg || '인증 오류'
    throw new Error(`공공데이터 인증 오류: ${reason} (${authErr.returnReasonCode ?? r.status}) — 인증키(Decoding)와 해당 API 활용신청 승인 여부를 확인하세요`)
  }
  const head = data?.response?.header
  if (head && !['0000', '00'].includes(String(head.resultCode))) {
    throw new Error(`${head.resultMsg} (${head.resultCode})`)
  }
  return data?.response?.body ?? {}
}

// items.item 이 없거나(빈 문자열) 1건(객체)이거나 여러 건(배열)인 경우를 모두 배열로
export function toList(body) {
  const item = body?.items?.item
  return !item ? [] : Array.isArray(item) ? item : [item]
}

export const https = (u) => (u ? u.replace(/^http:\/\//, 'https://') : '')
export const stripHtml = (s = '') => String(s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

// 제주 범위 (위도·경도) 안에 있는지
export const inJeju = (lat, lng) => lat > 33.0 && lat < 33.7 && lng > 126.0 && lng < 127.1
