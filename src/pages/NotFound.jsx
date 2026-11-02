import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="text-center py-5 px-3" style={{ minHeight: '60vh' }}>
      <div className="display-1">🌊</div>
      <h1 className="h3 fw-bold mt-3">길을 잃었어요</h1>
      <p className="text-muted">찾으시는 페이지가 없어요.</p>
      <Link to="/" className="btn btn-primary px-4">홈으로 돌아가기</Link>
    </div>
  )
}
