import { route } from '../server/http.js'
import { searchPhotos, debugPhotos } from '../server/photos.js'

export default route(({ keyword, rows, debug }) =>
  (debug ? debugPhotos({ keyword: keyword || '제주' }) : searchPhotos({ keyword, rows })), { ttl: 600 })
