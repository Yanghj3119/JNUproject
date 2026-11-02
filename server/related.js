// 한국관광공사 관광지별 연관 관광지 정보 (TarRlteTarService1) — "함께 가는 곳"
// 주의: 파라미터(areaCd·signguCd 코드 체계)는 활용가이드로 한 번 더 확인하세요
import { callApi, toList, tourParams } from './lib.js'
import { resolvePlace } from './tour.js'

const BASE = 'https://apis.data.go.kr/B551011/TarRlteTarService1'

// 통계 기준월: 두 달 전 (데이터 반영 지연 고려)
function baseYm() {
  const d = new Date(Date.now() + 9 * 3600e3)
  d.setUTCMonth(d.getUTCMonth() - 2)
  return d.toISOString().slice(0, 7).replace('-', '')
}

export async function getRelated({ place_name = '', addr = '' } = {}) {
  if (!place_name) throw new Error('place_name 이 필요해요')
  let address = addr
  if (!address) address = (await resolvePlace(place_name))?.addr ?? ''
  const signguCd = address.includes('서귀포') ? '50130' : '50110'

  const body = await callApi(`${BASE}/searchKeyword1`, tourParams({
    baseYm: baseYm(), areaCd: 50, signguCd, keyword: place_name, numOfRows: 10, pageNo: 1,
  }))
  return toList(body).map((r) => ({
    name: r.rlteTatsNm, area: [r.rlteRegnNm, r.rlteSignguNm].filter(Boolean).join(' '),
    category: r.rlteCtgryMclsNm || r.rlteCtgryLclsNm, rank: Number(r.rlteRank) || undefined,
  })).filter((r) => r.name)
}
