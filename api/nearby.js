import { route } from '../server/http.js'
import { findNearby } from '../server/tour.js'

export default route(({ lat, lng, radius, type, exclude }) =>
  findNearby({ lat, lng, radius, contentTypeId: type, exclude }), { ttl: 3600 })
