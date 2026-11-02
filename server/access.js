// 한국관광공사 무장애 여행 정보 (KorWithService2) — 휠체어·유모차 등 접근성
import { callApi, toList, tourParams, stripHtml } from './lib.js'
import { resolvePlace } from './tour.js'

const BASE = 'https://apis.data.go.kr/B551011/KorWithService2'

const LABELS = {
  parking: '주차', publictransport: '대중교통', wheelchair: '휠체어', exit: '출입구', elevator: '엘리베이터',
  restroom: '장애인 화장실', handicapetc: '지체장애 기타', braileblock: '점자블록', helpdog: '안내견 동반',
  guidehuman: '안내요원', audioguide: '오디오 가이드', bigprint: '큰활자 안내', brailepromotion: '점자 홍보물',
  signguide: '수어 안내', hearingroom: '청각장애 객실', stroller: '유모차 대여', lactationroom: '수유실',
  babysparechair: '유아 보조의자', infantsfamilyetc: '영유아 기타',
}

// ⑤ check_accessibility — contentId 또는 장소명으로 무장애 정보 조회
export async function checkAccessibility({ contentId = '', place_name = '' } = {}) {
  let id = contentId, title = place_name
  if (!id) {
    const p = await resolvePlace(place_name)
    if (!p) return { title: place_name, items: [], note: '장소를 찾지 못했어요' }
    id = p.id; title = p.title
  }
  const body = await callApi(`${BASE}/detailWithTour2`, tourParams({ contentId: id }))
  const d = toList(body)[0]
  if (!d) return { title, contentId: id, items: [], note: '등록된 무장애 정보가 없어요' }
  const items = Object.entries(LABELS)
    .filter(([k]) => d[k] && String(d[k]).trim())
    .map(([k, label]) => ({ key: k, label, value: stripHtml(d[k]) }))
  return { title, contentId: id, items, note: items.length ? '' : '등록된 무장애 정보가 없어요' }
}
