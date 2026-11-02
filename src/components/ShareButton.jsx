import { Dropdown } from 'react-bootstrap'
import { canKakaoShare, copyLink, shareKakao, shareNative } from '../lib/share'
import { useAppStore } from '../store/useAppStore'

// 공유 버튼: 카카오톡 · 기기 공유 · 링크 복사
// getContent() 는 눌렀을 때 { title, description, url, imageUrl? } 를 돌려준다 (최신 값을 쓰기 위해 함수로 받음)
export default function ShareButton({ getContent, className = 'btn btn-sm btn-outline-sea', label = '공유' }) {
  const toast = useAppStore((s) => s.toast)

  const run = async (kind) => {
    const c = { imageUrl: `${window.location.origin}/images/jeju-beach.jpg`, ...getContent() }
    try {
      if (kind === 'kakao') { await shareKakao(c); toast('카카오톡 공유창을 열었어요') }
      else if (kind === 'native') await shareNative(c)
      else { await copyLink(c.url); toast('링크를 복사했어요') }
    } catch (e) {
      if (e?.name === 'AbortError') return
      toast(kind === 'kakao' ? `카카오톡 공유에 실패했어요. 링크 복사를 이용해 주세요. (${e.message})` : e.message, 'warning')
    }
  }

  return (
    <Dropdown align="end">
      <Dropdown.Toggle as="button" type="button" className={className}><i className="bi bi-share me-1" />{label}</Dropdown.Toggle>
      <Dropdown.Menu>
        {canKakaoShare && <Dropdown.Item onClick={() => run('kakao')}><i className="bi bi-chat-fill me-2" style={{ color: '#3c1e1e' }} />카카오톡으로 공유</Dropdown.Item>}
        {typeof navigator !== 'undefined' && navigator.share && <Dropdown.Item onClick={() => run('native')}><i className="bi bi-box-arrow-up me-2" />다른 앱으로 공유</Dropdown.Item>}
        <Dropdown.Item onClick={() => run('copy')}><i className="bi bi-link-45deg me-2" />링크 복사</Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown>
  )
}
