// 제주데이터허브 "올레길 위치 정보"(코스 번호·이름·시점·종점·길이·소요시간·무장애 여부)를 public/data/olle.json 에 합친다.
// 실행: node --env-file=.env.local scripts/bake-olle.mjs   (키는 .env.local 에서만 읽고 결과 파일에는 들어가지 않는다)
import { readFileSync, writeFileSync } from 'node:fs'
import { callHub } from '../server/hub.js'

const FILE = new URL('../public/data/olle.json', import.meta.url)
const old = JSON.parse(readFileSync(FILE, 'utf8'))
const rows = await callHub('olle', {}, 200)
const byNo = new Map(old.map((c) => [c.no, c]))
const sortKey = (no) => { const [a, b = '0'] = String(no).split('-'); return Number(a) * 10 + Number(b) / 10 }

const out = rows.map((r) => {
  const no = String(r.courseNumber).replace('코스', '').trim()
  const a = { lat: Number(r.startLatitude), lng: Number(r.startLongitude) }
  const b = { lat: Number(r.endLatitude), lng: Number(r.endLongitude) }
  const base = byNo.get(no)
  const info = {
    fullName: String(r.courseName).replace(/\s+/g, ' ').trim(),
    hours: String(r.estimatedTime ?? '').trim(),
    wheelchair: r.wheelchairCourseFlag === true || r.wheelchairCourseFlag === 'true',
    kmOfficial: Number(r.courseLength) || null,
  }
  if (base) {
    // 경로선이 있는 코스(osm)는 선과 어긋나지 않게 기존 시점·종점을 두고, 점선 코스는 공식 좌표로 바꾼다
    const keepGeo = base.basis === 'osm'
    const next = { ...base, ...info, kmOsm: base.km ?? null, km: info.kmOfficial ?? base.km }
    if (!keepGeo) { next.a = a; next.b = b; next.from = r.startPoint; next.to = r.endPoint; next.segments = [[[a.lat, a.lng], [b.lat, b.lng]]] }
    return next
  }
  // 우도·가파도 같은 부속 코스(1-1, 7-1 …)는 지도 위치만 있는 코스로 추가한다 (시점=종점이면 점을 살짝 띄워 선이 보이게)
  const loop = a.lat === b.lat && a.lng === b.lng
  const b2 = loop ? { lat: b.lat + 0.0004, lng: b.lng + 0.0004 } : b
  return {
    no, name: String(r.courseNumber).trim(), title: info.fullName.replace(/\s*올레$/, ''), from: r.startPoint, to: r.endPoint,
    a, b, basis: 'ends', km: info.kmOfficial, loop, segments: [[[a.lat, a.lng], [b2.lat, b2.lng]]], ...info,
  }
})
out.sort((x, y) => sortKey(x.no) - sortKey(y.no))
writeFileSync(FILE, JSON.stringify(out))
console.log(`올레길 ${out.length}개 코스 저장 (기존 ${old.length}개)`)
