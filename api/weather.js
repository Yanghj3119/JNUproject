import { route } from '../server/http.js'
import { getWeather } from '../server/weather.js'

export default route(({ place, lat, lng }) => getWeather({ place, lat, lng }), { ttl: 1800 })
