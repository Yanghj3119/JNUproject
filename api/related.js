import { route } from '../server/http.js'
import { getRelated } from '../server/related.js'

export default route(({ name, addr }) => getRelated({ place_name: name, addr }), { ttl: 3600 })
