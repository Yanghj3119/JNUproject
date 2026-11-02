import { Link } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { distLabel, typeMeta } from '../lib/format'

// 주변 명소 등 "장소" 한 곳을 보여 주는 가로형 카드
export default function PlaceCard({ place }) {
  const faved = useAppStore((s) => s.favorites.some((f) => f.source === 'place' && f.item_id === String(place.id)))
  const toggle = useAppStore((s) => s.toggleFavorite)
  const meta = typeMeta(place.type)

  return (
    <div className="jp-place">
      <Link to={`/explore?q=${encodeURIComponent(place.title)}`} className="jp-place-img">
        {place.image
          ? <img src={place.image} alt={place.title} loading="lazy" />
          : <i className={`bi bi-${meta.icon}`} style={{ color: meta.color }} />}
      </Link>
      <div className="flex-grow-1 min-w-0">
        <div className="fw-semibold text-truncate">{place.title}</div>
        <div className="small text-muted text-truncate">{place.addr}</div>
        <div className="small mt-1">
          <span className="jp-tag" style={{ '--c': meta.color }}>{meta.label}</span>
          {place.dist != null && <span className="ms-2 text-muted"><i className="bi bi-signpost-split me-1" />{distLabel(place.dist)}</span>}
        </div>
      </div>
      <button
        type="button" className={`btn btn-sm jp-iconbtn ${faved ? 'on' : ''}`} aria-label="보관함에 담기"
        onClick={() => toggle({ source: 'place', id: place.id, title: place.title, image: place.image })}
      >
        <i className={`bi bi-bookmark-heart${faved ? '-fill' : ''}`} />
      </button>
    </div>
  )
}
