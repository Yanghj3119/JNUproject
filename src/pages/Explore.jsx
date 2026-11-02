import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Col, Container, Row } from 'react-bootstrap'
import { fetchPhotos } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { monthOf } from '../lib/format'
import PageHeader from '../components/PageHeader'
import PhotoCard from '../components/PhotoCard'
import Status from '../components/Status'

const QUICK = ['', '오름', '바다', '폭포', '해변', '유채꽃', '일출', '한라산']

export default function Explore() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [input, setInput] = useState(q)
  const [month, setMonth] = useState(0) // 0 = 전체

  const { data, loading, error } = useAsync(() => fetchPhotos(q, 24), [q])
  const list = (data ?? []).filter((p) => !month || monthOf(p.month) === month)

  const submit = (e) => { e.preventDefault(); setParams(input.trim() ? { q: input.trim() } : {}) }

  return (
    <Container>
      <PageHeader icon="images" title="사진 탐색" sub="사진을 보고 마음에 드는 곳을 눌러 촬영지·주변 명소·날씨를 확인하세요." />

      <form className="d-flex gap-2 mb-3" onSubmit={submit}>
        <input className="form-control form-control-lg rounded-pill" placeholder="검색어 (비워 두면 제주 전체)" value={input} onChange={(e) => setInput(e.target.value)} />
        <button className="btn btn-primary px-4" type="submit"><i className="bi bi-search" /></button>
      </form>

      <div className="d-flex flex-wrap gap-2 mb-3">
        {QUICK.map((t) => (
          <button key={t} type="button" className={`jp-month ${q === t ? 'on' : ''}`} onClick={() => { setInput(t); setParams(t ? { q: t } : {}) }}>
            {t ? `#${t}` : '전체'}
          </button>
        ))}
      </div>

      <div className="jp-months mb-4">
        <button type="button" className={`jp-month ${month === 0 ? 'on' : ''}`} onClick={() => setMonth(0)}>촬영월 전체</button>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <button key={m} type="button" className={`jp-month ${month === m ? 'on' : ''}`} onClick={() => setMonth(m)}>{m}월</button>
        ))}
      </div>

      <Status loading={loading} error={error} empty={!loading && !error && !list.length}
        emptyText={month ? `${month}월에 찍은 사진이 없어요. 다른 달을 눌러 보세요.` : '검색 결과가 없어요'} />
      <Row xs={1} sm={2} lg={3} xl={4} className="g-3">
        {list.map((p) => <Col key={p.id || p.image}><PhotoCard photo={p} /></Col>)}
      </Row>
    </Container>
  )
}
