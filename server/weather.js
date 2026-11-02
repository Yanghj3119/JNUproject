// 기상청 단기예보 조회서비스 (VilageFcstInfoService_2.0)
import { callApi, toList } from './lib.js'
import { getSunTimes } from './sun.js'

const BASE = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst'
const SKY = { 1: '맑음', 3: '구름많음', 4: '흐림' }
const PTY = { 0: '없음', 1: '비', 2: '비/눈', 3: '눈', 4: '소나기' }

export const PRESETS = {
  제주시: [33.4996, 126.5312], 서귀포시: [33.2541, 126.5601], 성산: [33.4585, 126.9425],
  애월: [33.4631, 126.331], 한림: [33.414, 126.265], 표선: [33.326, 126.831], 중문: [33.25, 126.412],
}

// 위경도 → 기상청 격자(nx, ny) : 기상청 공식 Lambert 변환식
export function toGrid(lat, lng) {
  const D = Math.PI / 180
  const re = 6371.00877 / 5.0
  const slat1 = 30 * D, slat2 = 60 * D, olon = 126 * D, olat = 38 * D
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn)
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5)
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5)
  ro = (re * sf) / Math.pow(ro, sn)
  let ra = Math.tan(Math.PI * 0.25 + lat * D * 0.5)
  ra = (re * sf) / Math.pow(ra, sn)
  let theta = lng * D - olon
  if (theta > Math.PI) theta -= 2 * Math.PI
  if (theta < -Math.PI) theta += 2 * Math.PI
  theta *= sn
  return { nx: Math.floor(ra * Math.sin(theta) + 43 + 0.5), ny: Math.floor(ro - ra * Math.cos(theta) + 136 + 0.5) }
}

// 발표시각: 02·05·08·11·14·17·20·23시 (발표 후 약 10분 뒤부터 조회 가능)
function baseDateTime() {
  const kst = new Date(Date.now() + 9 * 3600e3 - 15 * 60e3)
  let h = [23, 20, 17, 14, 11, 8, 5, 2].find((x) => x <= kst.getUTCHours())
  let day = kst
  if (h === undefined) { day = new Date(kst.getTime() - 24 * 3600e3); h = 23 }
  return { base_date: day.toISOString().slice(0, 10).replaceAll('-', ''), base_time: String(h).padStart(2, '0') + '00' }
}

function nearestPreset(lat, lng) {
  let best = '제주시', min = Infinity
  for (const [name, [la, ln]] of Object.entries(PRESETS)) {
    const d = (la - lat) ** 2 + (ln - lng) ** 2
    if (d < min) { min = d; best = name }
  }
  return best
}

// ④ get_weather — 지역명 또는 좌표로 앞으로 몇 시간의 날씨
export async function getWeather({ place = '', lat, lng } = {}) {
  let la = Number(lat), ln = Number(lng), name = place
  if (!(la && ln)) {
    name = PRESETS[place] ? place : '제주시';
    [la, ln] = PRESETS[name]
  } else if (!name) name = nearestPreset(la, ln)

  const grid = toGrid(la, ln)
  const base = baseDateTime()
  const body = await callApi(BASE, { dataType: 'JSON', numOfRows: 300, pageNo: 1, ...grid, ...base })

  const slots = {}
  for (const it of toList(body)) (slots[`${it.fcstDate} ${it.fcstTime}`] ??= {})[it.category] = it.fcstValue

  const forecast = Object.entries(slots).slice(0, 8).map(([time, v]) => ({
    time: `${time.slice(4, 6)}/${time.slice(6, 8)} ${time.slice(9, 11)}시`,
    temp: Number(v.TMP), sky: SKY[v.SKY] ?? String(v.SKY),
    rain: PTY[v.PTY] ?? String(v.PTY), rainy: Number(v.PTY) > 0,
    pop: Number(v.POP), hum: Number(v.REH), wind: Number(v.WSD),
  }))

  const wet = forecast.slice(0, 6).some((f) => f.rainy || f.pop >= 60)
  const sun = await getSunTimes({ lat: la, lng: ln }).catch(() => null) // 일출·일몰 (실패해도 날씨는 그대로)
  return {
    place: name, grid, now: forecast[0] ?? null, forecast, sun,
    advice: wet ? '비 소식이 있어요. 박물관·전시관 같은 실내 명소를 함께 계획하세요.' : '야외 관광하기 좋은 날씨예요.',
    wet,
  }
}
