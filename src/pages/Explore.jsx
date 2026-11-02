import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Col, Container, Row } from 'react-bootstrap'
import { fetchPhotos } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { monthOf, shuffleDiverse } from '../lib/format'
import PhotoCard from '../components/PhotoCard'
import Status from '../components/Status'

const QUICK = ['', '오름', '바다', '폭포', '해변', '유채꽃', '일출', '한라산']

export default function Explore() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [input, setInput] = useState(q)
  const [month, setMonth] = useState(0) // 0 = 전체

  const { data, loading, error } = useAsync(() => fetchPhotos(q, 80), [q])
  const shuffled = useMemo(() => shuffleDiverse(data ?? [], 2), [data]) // 검색할 때마다 다른 순서, 같은 제목은 최대 2장
  const list = shuffled.filter((p) => !month || monthOf(p.month) === month)

  const counts = {}
  for (const p of shuffled) { const m = monthOf(p.month); if (m) counts[m] = (counts[m] ?? 0) + 1 }
  const unknown = shuffled.filter((p) => !monthOf(p.month)).length

  const submit = (e) => { e.preventDefault(); setMonth(0); setParams(input.trim() ? { q: input.trim() } : {}) }
  const pick = (t) => { setInput(t); setMonth(0); setParams(t ? { q: t } : {}) }

  return (
    <Container>
      <div className="jp-pagehead">
        <div>
          <div className="jp-eyebrow mb-1">사진 탐색</div>
          <h1 className="h3 fw-bold mb-1">사진으로 고르는 제주</h1>
          <p className="text-muted mb-0">카드에 마우스를 올리면 촬영지와 시기를 볼 수 있어요. 마음에 들면 AI에게 코스를 물어보세요.</p>
        </div>
      </div>

      <form className="d-flex gap-2 mb-3" onSubmit={submit}>
        <input className="form-control form-control-lg" placeholder="검색어 (비워 두면 제주 전체)" value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="btn btn-primary px-4" type="submit" aria-label="검색"><i className="bi bi-search" /></button>
      </form>

      <div className="d-flex flex-wrap gap-2 mb-3">
        {QUICK.map((t) => (
          <button key={t} type="button" className={`jp-month ${q === t ? 'on' : ''}`} onClick={() => pick(t)}>{t ? `#${t}` : '전체'}</button>
        ))}
      </div>

      <div className="jp-months mb-2">
        <button type="button" className={`jp-month ${month === 0 ? 'on' : ''}`} onClick={() => setMonth(0)}>월 전체</button>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <button key={m} type="button" className={`jp-month ${month === m ? 'on' : ''}`} disabled={!counts[m]} onClick={() => setMonth(m)}>
            {m}월{counts[m] ? ` ${counts[m]}` : ''}
          </button>
        ))}
      </div>
      {!loading && shuffled.length > 0 && unknown > 0 && (
        <div className="small text-muted mb-3">촬영월 정보가 없는 사진 {unknown}장은 ‘월 전체’에서만 보여요.</div>
      )}

      <Status loading={loading} error={error} empty={!loading && !error && !list.length}
        emptyText={month ? `${month}월에 찍은 사진이 없어요. 다른 달을 눌러 보세요.` : '검색 결과가 없어요'} />
      <Row xs={1} sm={2} lg={3} xl={4} className="g-3 mt-1">
        {list.map((p) => <Col key={p.id || p.image}><PhotoCard photo={p} /></Col>)}
      </Row>
    </Container>
  )
}
