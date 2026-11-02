import { Alert, Spinner } from 'react-bootstrap'

// 로딩 · 에러 · 빈 결과를 한 곳에서 보여 줌. 문제가 없으면 아무것도 그리지 않음
export default function Status({ loading, error, empty, emptyText = '결과가 없어요', compact = false }) {
  if (loading) {
    return (
      <div className={`text-center text-muted ${compact ? 'py-3' : 'py-5'}`}>
        <Spinner size="sm" className="me-2" />불러오는 중…
      </div>
    )
  }
  if (error) return <Alert variant="warning" className="my-3 small mb-0"><i className="bi bi-exclamation-triangle me-1" />{error}</Alert>
  if (empty) return <div className={`text-center text-muted ${compact ? 'py-3' : 'py-5'}`}>{emptyText}</div>
  return null
}
