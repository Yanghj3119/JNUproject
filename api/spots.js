import { route } from '../server/http.js'
import { listSpots } from '../server/tour.js'

export default route(({ type }) => listSpots({ type }), { ttl: 3600 })
