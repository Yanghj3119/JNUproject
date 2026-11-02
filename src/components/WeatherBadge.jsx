import { fetchWeather } from '../api/client'
import { useAsync } from '../lib/useAsync'
import { skyIcon } from '../lib/format'
import Status from './Status'

// 지역명(place) 또는 좌표(lat,lng)의 날씨를 스스로 불러와 보여 주는 컴포넌트
// variant="card": 큰 카드(예보 포함), 기본: 한 줄 배지
export default function WeatherBadge({ place, lat, lng, variant = 'badge' }) {
  const { data, loading, error } = useAsync(() => fetchWeather({ place, lat, lng }), [place, lat, lng])

  if (loading || error) {
    return variant === 'card' ? <Status loading={loading} error={error} compact /> : (
      <span className="jp-weather text-muted">{loading ? '날씨 확인 중…' : <><i className="bi bi-cloud-slash me-1" />날씨 정보 없음</>}</span>
    )
  }
  const now = data.now
  if (!now) return null

  if (variant === 'badge') {
    return (
      <span className="jp-weather">
        <i className={`bi bi-${skyIcon(now)} me-1`} />
        <strong>{data.place}</strong> {now.temp}° · {now.rainy ? now.rain : now.sky} · 강수 {now.pop}%
      </span>
    )
  }
  return (
    <div className="jp-weather-card">
      <div className="d-flex align-items-center gap-3">
        <i className={`bi bi-${skyIcon(now)} display-5`} />
        <div>
          <div className="small opacity-75">{data.place}</div>
          <div className="fs-2 fw-bold lh-1">{now.temp}°</div>
          <div className="small">{now.rainy ? now.rain : now.sky} · 강수확률 {now.pop}%</div>
        </div>
      </div>
      <div className="jp-forecast">
        {data.forecast.slice(0, 6).map((f) => (
          <div key={f.time} className="text-center">
            <div className="small opacity-75">{f.time.slice(6)}</div>
            <i className={`bi bi-${skyIcon(f)}`} />
            <div className="small fw-semibold">{f.temp}°</div>
          </div>
        ))}
      </div>
      <div className={`small mt-2 ${data.wet ? 'fw-semibold' : 'opacity-75'}`}>
        <i className={`bi bi-${data.wet ? 'umbrella' : 'sun'} me-1`} />{data.advice}
      </div>
    </div>
  )
}
