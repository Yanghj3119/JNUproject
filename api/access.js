import { route } from '../server/http.js'
import { checkAccessibility } from '../server/access.js'

export default route(({ contentId, name }) => checkAccessibility({ contentId, place_name: name }), { ttl: 3600 })
