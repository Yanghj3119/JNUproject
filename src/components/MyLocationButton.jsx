// 지도 위의 "내 위치" 버튼 — 누르면 내 위치를 표시하고, 다시 누르면 끈다
export default function MyLocationButton({ loc }) {
  return (
    <button type="button" className={`jp-map-me ${loc.me ? 'on' : ''}`} onClick={loc.toggle} disabled={loc.busy}
      title={loc.me ? '내 위치 표시 끄기 (처음 보기로 돌아가요)' : '내 위치를 지도에 표시'}>
      <i className={`bi bi-${loc.busy ? 'hourglass-split' : loc.me ? 'x-circle' : 'crosshair'} me-1`} />
      {loc.busy ? '확인 중…' : loc.me ? '내 위치 끄기' : '내 위치'}
    </button>
  )
}
