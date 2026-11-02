import { Container } from 'react-bootstrap'

// 페이지 맨 위 사진 배너 — 페이지마다 다른 제주 사진으로 분위기를 바꾼다
// img: public/images 경로, pos: 배경 위치(CSS background-position), children: 오른쪽 버튼 등
export default function PageBanner({ img, pos = '50% 50%', eyebrow, title, sub, children }) {
  return (
    <Container className="pt-4">
      <section className="jp-banner" style={{ backgroundImage: `url(${img})`, backgroundPosition: pos }}>
        <div className="jp-banner-inner">
          <div>
            {eyebrow && <div className="jp-eyebrow mb-1">{eyebrow}</div>}
            <h1 className="h3 fw-bold mb-1">{title}</h1>
            {sub && <p className="mb-0 jp-banner-sub">{sub}</p>}
          </div>
          {children && <div className="jp-banner-actions">{children}</div>}
        </div>
      </section>
    </Container>
  )
}
