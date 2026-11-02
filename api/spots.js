import { route } from '../server/http.js'
import { listSpots } from '../server/tour.js'
import { listHubPlaces } from '../server/hub.js'

const HUB_KINDS = ['oreum', 'museum', 'souvenir']

// type 이 oreum|museum|souvenir 이면 제주데이터허브, 숫자(12·14·15·39)면 한국관광공사 (page·rows 로 더 많이 받을 수 있음)
export default route(({ type, page, rows }) => (HUB_KINDS.includes(type) ? listHubPlaces({ kind: type }) : listSpots({ type, page, rows })), { ttl: 3600 })
