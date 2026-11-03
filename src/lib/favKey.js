// 위시리스트에서 "같은 장소"인지 판단하는 규칙
// 화면마다 장소 번호 체계가 달라서(사진 번호·관광정보 번호·제주데이터허브 번호) 번호만으로는 같은 곳을 알아보지 못한다.
// 그래서 번호가 같거나, 이름을 정리한 값이 같으면 같은 장소로 본다.
//  · 정리: 공백·괄호·기호를 없애고 소문자로, 사진 제목 끝의 "…의 일몰" 같은 꾸밈말 한 단어는 뺀다 (3글자 이상 남을 때만)
export function nameKey(title) {
  const n = String(title ?? '').toLowerCase().replace(/[\s·()\[\]{}'"“”‘’,.\-_/]/g, '')
  const base = n.replace(/의[^의]{1,4}$/, '')
  return base.length >= 3 ? base : n
}

// 위시리스트에 이미 있는 장소인지 (같은 화면의 번호가 같거나, 이름이 같을 때)
export function matchFavorites(favorites, { source, id, title }) {
  const key = nameKey(title)
  return favorites.filter((f) => (f.source === source && f.item_id === String(id)) || (key && nameKey(f.title) === key))
}
