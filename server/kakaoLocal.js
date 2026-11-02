// 카카오 로컬 API(키워드로 장소 검색) — 관광공사 데이터에 없는 유명 장소를 찾는 데 쓴다.
// 서버에서만 쓰는 REST API 키(KAKAO_REST_KEY)가 필요하다. 없으면 건너뛴다.
// (카카오 디벨로퍼스 > 앱 키 > REST API 키, '카카오맵' 사용 설정 ON 이어야 한다)
export async function kakaoPlace(keyword) {
  const key = process.env.KAKAO_REST_KEY?.trim()
  if (!key || !keyword) return null

  const qs = new URLSearchParams({ query: `제주 ${keyword}`, x: '126.55', y: '33.38', radius: '50000', size: '5' }) // 제주 중심 50km 안쪽을 우선
  const r = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?${qs}`, {
    headers: { Authorization: `KakaoAK ${key}` },
    signal: AbortSignal.timeout(6000),
  })
  if (!r.ok) throw new Error(`카카오 로컬 API 오류 (${r.status})`)
  const j = await r.json()
  const d = (j.documents ?? []).find((x) => /제주/.test(`${x.address_name} ${x.road_address_name}`))
  return d
    ? { id: `kk-${d.id}`, title: d.place_name, addr: d.road_address_name || d.address_name, lat: Number(d.y), lng: Number(d.x), type: '12', hub: true, url: d.place_url }
    : null
}
