import { Link } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { matchFavorites } from '../lib/favKey'
import { photoLink } from '../lib/format'

// 사진 한 장 카드 — 마우스를 올리면 촬영지·촬영자·키워드가 나타나고, 바로 AI 에게 물어볼 수 있다
export default function PhotoCard({ photo }) {
  const faved = useAppStore((s) => matchFavorites(s.favorites, { source: 'photo', id: photo.id, title: photo.title }).length > 0)
  const toggle = useAppStore((s) => s.toggleFavorite)
  const tags = String(photo.keywords || '').split(/[,#]/).map((t) => t.trim()).filter(Boolean).slice(0, 3)
  const ask = `${photo.title}${photo.location ? ` (${photo.location})` : ''}은(는) 어떤 곳이야? 근처 코스도 추천해줘`

  return (
    <div className="jp-photo">
      <Link to={photoLink(photo)} className="jp-photo-img" aria-label={photo.title}>
        <img src={photo.image} alt={photo.title} loading="lazy" />
        <div className="jp-photo-hover">
          <div className="t">{photo.title}</div>
          <div className="m">
            {photo.location && <span><i className="bi bi-geo-alt me-1" />{photo.location}</span>}
            {photo.photographer && <span><i className="bi bi-camera me-1" />{photo.photographer}</span>}
          </div>
          {tags.length > 0 && <div className="k">{tags.map((t) => <span key={t}>#{t}</span>)}</div>}
        </div>
      </Link>
      <Link to={`/agent?q=${encodeURIComponent(ask)}`} className="jp-askbtn"><i className="bi bi-stars" />AI에게 묻기</Link>
      <button
        type="button" className={`jp-heart ${faved ? 'on' : ''}`} aria-label="위시리스트에 담기"
        onClick={() => toggle({ source: 'photo', id: photo.id, title: photo.title, image: photo.image })}
      >
        <i className={`bi bi-heart${faved ? '-fill' : ''}`} />
      </button>
      <div className="jp-photo-body">
        <div className="fw-semibold text-truncate">{photo.title}</div>
        <div className="small text-muted text-truncate">{photo.location || '촬영지 정보 없음'}</div>
      </div>
    </div>
  )
}
