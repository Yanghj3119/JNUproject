import { fetchCrowd } from '../api/client'
import { useAsync } from '../lib/useAsync'
import Status from './Status'

// 향후 30일 방문객 집중률 — 막대가 낮을수록 한적한 날
export default function CrowdChart({ name, addr }) {
  const { data, loading, error } = useAsync(() => fetchCrowd({ name, addr }), [name])
  const days = data?.days ?? []
  const max = Math.max(1, ...days.map((d) => d.rate))
  const fmt = (d) => `${Number(d.slice(4, 6))}/${Number(d.slice(6, 8))}`

  return (
    <div className="jp-panel">
      <Status loading={loading} error={error} empty={!loading && !error && !days.length} emptyText="혼잡도 예측 정보가 없어요" compact />
      {days.length > 0 && (
        <>
          {data.quietest && (
            <div className="small mb-2"><i className="bi bi-check2-circle text-jp me-1" />가장 한적한 날: <strong>{fmt(data.quietest.date)}</strong></div>
          )}
          <div className="jp-crowd" role="img" aria-label="향후 방문객 집중률 예측">
            {days.map((d) => {
              const lvl = d.rate / max
              return (
                <div key={d.date} className="jp-crowd-bar" title={`${fmt(d.date)} · 집중률 ${d.rate}`}
                  style={{ height: `${Math.max(8, lvl * 100)}%`, background: lvl > 0.75 ? '#e5484d' : lvl > 0.45 ? '#ffb020' : '#2fb36b' }} />
              )
            })}
          </div>
          <div className="d-flex justify-content-between small text-muted mt-1"><span>{fmt(days[0].date)}</span><span>{fmt(days[days.length - 1].date)}</span></div>
        </>
      )}
    </div>
  )
}
