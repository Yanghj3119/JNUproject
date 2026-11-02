import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="jp-404" style={{ backgroundImage: 'url(/images/jeju-stonewall.jpg)' }}>
      <div className="text-center px-3">
        <div className="jp-eyebrow" style={{ color: '#bfdbfe' }}>404</div>
        <h1 className="h2 fw-bold mt-2">페이지를 찾을 수 없어요</h1>
        <p className="mb-4 opacity-75">주소가 바뀌었거나 없는 페이지예요.</p>
        <Link to="/" className="btn btn-light px-4">홈으로 돌아가기</Link>
      </div>
    </div>
  )
}
