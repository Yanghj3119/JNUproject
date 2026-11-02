import { route } from '../server/http.js'
import { getCrowd } from '../server/crowd.js'

export default route(({ name, addr }) => getCrowd({ place_name: name, addr }), { ttl: 3600 })
