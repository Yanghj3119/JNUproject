// 한국관광공사 관광지 집중률 방문자 추이 예측 정보 (TatsCnctrRateService) — 향후 30일 혼잡도
// 주의: 오퍼레이션명(tatsCnctrRatedList)·응답 필드명은 활용가이드로 확인 필요 (/status 에서 점검)
import { callApi, toList, tourParams } from './lib.js'
import { resolvePlace } from './tour.js'

const BASE = 'https://apis.data.go.kr/B551011/TatsCnctrRateService'

export async function getCrowd({ place_name = '', addr = '' } = {}) {
  if (!place_name) throw new Error('place_name 이 필요해요')
  let address = addr
  if (!address) address = (await resolvePlace(place_name))?.addr ?? ''
  const signguCd = address.includes('서귀포') ? '50130' : '50110'

  const body = await callApi(`${BASE}/tatsCnctrRatedList`, tourParams({
    areaCd: 50, signguCd, tAtsNm: place_name, numOfRows: 40, pageNo: 1,
  }))
  const days = toList(body)
    .map((r) => ({ date: String(r.baseYmd ?? r.baseYm ?? ''), rate: Number(r.cnctrRate), name: r.tAtsNm }))
    .filter((r) => r.date && Number.isFinite(r.rate))
    .sort((a, b) => a.date.localeCompare(b.date))

  const best = days.length ? days.reduce((a, b) => (b.rate < a.rate ? b : a)) : null
  return { name: days[0]?.name ?? place_name, days, quietest: best }
}
