import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="text-center py-5 px-3" style={{ minHeight: '60vh' }}>
      <div className="jp-eyebrow mt-5">404</div>
      <h1 className="h3 fw-bold mt-2">페이지를 찾을 수 없어요</h1>
      <p className="text-muted">주소가 바뀌었거나 없는 페이지예요.</p>
      <Link to="/" className="btn btn-primary px-4">홈으로 돌아가기</Link>
    </div>
  )
}
