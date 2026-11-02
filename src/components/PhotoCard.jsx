import { Link } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { monthOf, photoLink } from '../lib/format'

// 사진 한 장을 보여 주는 카드 (탐색·홈·보관함 공용)
export default function PhotoCard({ photo }) {
  const faved = useAppStore((s) => s.favorites.some((f) => f.source === 'photo' && f.item_id === String(photo.id)))
  const toggle = useAppStore((s) => s.toggleFavorite)
  const month = monthOf(photo.month)

  return (
    <div className="jp-photo">
      <Link to={photoLink(photo)} className="jp-photo-img" aria-label={photo.title}>
        <img src={photo.image} alt={photo.title} loading="lazy" />
        {month > 0 && <span className="jp-chip">{month}월</span>}
      </Link>
      <button
        type="button" className={`jp-heart ${faved ? 'on' : ''}`} aria-label="보관함에 담기"
        onClick={() => toggle({ source: 'photo', id: photo.id, title: photo.title, image: photo.image })}
      >
        <i className={`bi bi-heart${faved ? '-fill' : ''}`} />
      </button>
      <div className="jp-photo-body">
        <div className="fw-semibold text-truncate">{photo.title}</div>
        <div className="small text-muted text-truncate"><i className="bi bi-geo-alt me-1" />{photo.location || '촬영지 정보 없음'}</div>
      </div>
    </div>
  )
}
