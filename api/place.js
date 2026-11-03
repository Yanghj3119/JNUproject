import { route } from '../server/http.js'
import { checkAccessibility } from '../server/access.js'
import { getRelated } from '../server/related.js'
import { getCrowd } from '../server/crowd.js'

// 장소 부가 정보 한 곳으로: /api/place?kind=access|related|crowd
// (Vercel 무료 플랜은 서버 함수를 12개까지만 허용해서, 작은 API 는 하나로 합쳐 둔다)
const KINDS = {
  access: (q) => checkAccessibility({ contentId: q.contentId, place_name: q.name }),
  related: (q) => getRelated({ place_name: q.name, addr: q.addr }),
  crowd: (q) => getCrowd({ place_name: q.name, addr: q.addr }),
}

export default route((q) => {
  const fn = KINDS[q.kind]
  if (!fn) throw new Error(`kind 는 ${Object.keys(KINDS).join(' | ')} 중 하나`)
  return fn(q)
}, { ttl: 3600 })
