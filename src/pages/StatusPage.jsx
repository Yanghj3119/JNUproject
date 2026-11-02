import { Container } from 'react-bootstrap'
import { fetchHealth } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { isSupabaseReady } from '../lib/supabase'
import PageHeader from '../components/PageHeader'
import Status from '../components/Status'

// 각 공공데이터 API가 실제로 응답하는지 점검 (활용신청 승인 여부 확인용)
export default function StatusPage() {
  const { data, loading, error } = useAsync(fetchHealth, [])

  const row = (name, ok, detail) => (
    <li key={name} className="list-group-item d-flex justify-content-between align-items-start gap-3">
      <div><i className={`bi bi-${ok ? 'check-circle-fill text-success' : 'x-circle-fill text-danger'} me-2`} />{name}
        {detail && <div className="small text-muted ms-4">{detail}</div>}</div>
    </li>
  )

  return (
    <Container style={{ maxWidth: 760 }}>
      <PageHeader icon="activity" title="연결 상태" sub="각 공공데이터 API와 서비스 연결을 점검해요." />
      <Status loading={loading} error={error} />
      <ul className="list-group mb-4">
        {row('React · 라우터', true)}
        {row('Supabase', isSupabaseReady, isSupabaseReady ? '' : '.env.local 의 VITE_SUPABASE_* 값이 필요해요')}
        {data && row('서버 함수 /api', true)}
        {data && row('공공데이터포털 키', data.keys.dataGoKr, data.keys.dataGoKr ? '' : 'DATA_GO_KR_KEY 가 없어요')}
        {data && row('제주데이터허브 프로젝트 키', data.keys.jejuHub, data.keys.jejuHub ? '' : 'JEJU_DATAHUB_KEY 가 없어요')}
        {row('카카오맵 키', Boolean(import.meta.env.VITE_KAKAO_MAP_KEY), import.meta.env.VITE_KAKAO_MAP_KEY ? `허용 도메인에 ${window.location.origin} 등록 필요` : 'VITE_KAKAO_MAP_KEY 가 없어요')}
        {data && row('Claude 키 (AI 가이드)', data.keys.anthropic, data.keys.anthropic ? '' : 'ANTHROPIC_API_KEY 가 없어요')}
        {data?.checks.map((c) => row(c.name, c.ok, c.ok ? `${c.ms}ms` : c.error))}
      </ul>
    </Container>
  )
}
