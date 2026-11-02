// 포토 스팟 테마 — 관광지 이름의 키워드로 분류한다 (서버의 AI 도구와 화면이 함께 쓰는 순수 함수)
// 한 장소가 여러 테마에 들어갈 수 있다 (예: "성산일출봉" → 일출·일몰, 오름·전망)
// 한 글자짜리 키워드는 엉뚱한 곳까지 걸리므로 피한다.
export const PHOTO_THEMES = [
  { id: 'sunrise', label: '일출·일몰', icon: 'sunrise', desc: '해돋이·노을을 담기 좋은 곳', words: ['일출', '일몰', '노을', '해돋이', '해넘이', '등대', '방파제', '포구', '연대', '새연교'] },
  { id: 'oreum', label: '오름·전망', icon: 'triangle', desc: '탁 트인 풍경과 능선', words: ['오름', '전망', '분화구', '굼부리', '망대', '탑망', '봉'] },
  { id: 'flower', label: '꽃·숲', icon: 'flower1', desc: '계절 꽃과 초록 숲길', words: ['유채', '수국', '동백', '억새', '핑크', '뮬리', '꽃', '정원', '수목원', '화원', '숲', '곶자왈', '휴양림', '식물원', '공원'] },
  { id: 'sea', label: '바다·해변', icon: 'water', desc: '에메랄드빛 바다와 모래사장', words: ['해변', '해수욕장', '해안', '포구', '우도', '비양', '가파도', '마라도', '바당', '어촌', '항'] },
  { id: 'waterfall', label: '폭포·계곡', icon: 'droplet', desc: '시원한 물줄기와 계곡', words: ['폭포', '계곡', '연못', '쇠소깍', '용천', '천지연', '정방'] },
  { id: 'culture', label: '돌담·마을', icon: 'house-door', desc: '제주다운 돌문화와 마을 풍경', words: ['돌문화', '돌담', '초가', '민속', '마을', '박물관', '미술관', '테마파크', '카페', '시장', '거리', '성지', '동굴', '굴'] },
]

export const themesOf = (spot) => {
  const t = `${spot?.title ?? ''}`
  return PHOTO_THEMES.filter((th) => th.words.some((w) => t.includes(w))).map((th) => th.id)
}

export const themeLabel = (id) => PHOTO_THEMES.find((t) => t.id === id)?.label ?? id
