import { route } from '../server/http.js'
import { searchPhotos } from '../server/photos.js'

export default route(({ keyword, rows }) => searchPhotos({ keyword, rows }), { ttl: 600 })
