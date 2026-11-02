import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Col, Container, Row } from 'react-bootstrap'
import { fetchPhotos } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { shuffleDiverse } from '../lib/format'
import PageBanner from '../components/PageBanner'
import PhotoCard from '../components/PhotoCard'
import Status from '../components/Status'

const QUICK = ['', '오름', '바다', '폭포', '해변', '유채꽃', '일출', '한라산']

export default function Explore() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [input, setInput] = useState(q)

  const { data, loading, error } = useAsync(() => fetchPhotos(q, 80), [q])
  const list = useMemo(() => shuffleDiverse(data ?? [], 2), [data]) // 검색할 때마다 다른 순서, 같은 제목은 최대 2장

  const submit = (e) => { e.preventDefault(); setParams(input.trim() ? { q: input.trim() } : {}) }
  const pick = (t) => { setInput(t); setParams(t ? { q: t } : {}) }

  return (
    <>
      <PageBanner
        img="/images/jeju-muhly.jpg" pos="50% 62%" eyebrow="사진 탐색" title="사진으로 고르는 제주"
        sub="카드에 마우스를 올리면 촬영지를 볼 수 있어요. 마음에 들면 AI에게 코스를 물어보세요."
      />
      <Container className="pt-4">
        <form className="d-flex gap-2 mb-3" onSubmit={submit}>
          <input className="form-control form-control-lg" placeholder="검색어 (비워 두면 제주 전체)" value={input} onChange={(e) => setInput(e.target.value)} />
          <button className="btn btn-primary px-4" type="submit" aria-label="검색"><i className="bi bi-search" /></button>
        </form>

        <div className="d-flex flex-wrap gap-2 mb-4">
          {QUICK.map((t) => (
            <button key={t} type="button" className={`jp-month ${q === t ? 'on' : ''}`} onClick={() => pick(t)}>{t ? `#${t}` : '전체'}</button>
          ))}
        </div>

        <Status loading={loading} error={error} empty={!loading && !error && !list.length} emptyText="검색 결과가 없어요" />
        <Row xs={1} sm={2} lg={3} xl={4} className="g-3">
          {list.map((p) => <Col key={p.id || p.image}><PhotoCard photo={p} /></Col>)}
        </Row>
      </Container>
    </>
  )
}
