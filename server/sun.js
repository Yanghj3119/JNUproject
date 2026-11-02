// 한국천문연구원 출몰시각 정보 (RiseSetInfoService) — 위치별 일출·일몰
// 주의: 오퍼레이션명(getLCRiseSetInfo)·응답 형식은 활용가이드로 확인 필요 (/status 에서 점검)
import { callApi, toList } from './lib.js'

const BASE = 'http://apis.data.go.kr/B090041/openapi/service/RiseSetInfoService'

const hhmm = (v) => {
  const s = String(v ?? '').trim()
  return /^\d{4,6}$/.test(s) ? `${s.slice(0, 2)}:${s.slice(2, 4)}` : ''
}

export async function getSunTimes({ lat, lng, date } = {}) {
  const d = date || new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10).replaceAll('-', '')
  const body = await callApi(`${BASE}/getLCRiseSetInfo`, {
    locdate: d, longitude: Number(lng).toFixed(4), latitude: Number(lat).toFixed(4), dnYn: 'Y', _type: 'json',
  })
  const it = toList(body)[0]
  if (!it) return null
  return { date: d, sunrise: hhmm(it.sunrise), sunset: hhmm(it.sunset), civilEvening: hhmm(it.civile) }
}
