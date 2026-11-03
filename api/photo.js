import { route } from '../server/http.js'
import { getPhotoInfo } from '../server/photos.js'

export default route(({ title, location, id }) => getPhotoInfo({ title, location, id }), { ttl: 21600 })
