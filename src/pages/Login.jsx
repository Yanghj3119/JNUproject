import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store/useAppStore'
import { isSupabaseReady } from '../lib/supabase'

// Supabase 가 돌려주는 영어 오류를 알기 쉬운 문장으로
const KR = [
  [/invalid login credentials/i, '이메일 또는 비밀번호가 맞지 않아요.'],
  [/email not confirmed/i, '이메일 인증이 아직이에요. 받은 메일의 링크를 눌러 주세요.'],
  [/already registered|already been registered/i, '이미 가입된 이메일이에요. 로그인해 주세요.'],
  [/password should be at least/i, '비밀번호는 6자 이상이어야 해요.'],
  [/rate limit|too many/i, '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'],
  [/valid email|invalid format/i, '이메일 형식을 확인해 주세요.'],
]
const korean = (m) => KR.find(([re]) => re.test(m))?.[1] ?? m

export default function Login() {
  const nav = useNavigate()
  const user = useAppStore((s) => s.user)
  const signIn = useAppStore((s) => s.signIn)
  const signUp = useAppStore((s) => s.signUp)
  const signInKakao = useAppStore((s) => s.signInKakao)
  const toast = useAppStore((s) => s.toast)

  const [mode, setMode] = useState('in') // 'in' | 'up'
  const [form, setForm] = useState({ email: '', password: '', name: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  if (user) return <Navigate to="/my" replace />

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const kakao = async () => {
    setError(''); setNotice('')
    try { await signInKakao() } // 성공하면 카카오 화면으로 이동하므로 이후 코드는 실행되지 않음
    catch (err) { setError(korean(err.message)) }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(''); setNotice(''); setBusy(true)
    try {
      if (mode === 'in') {
        await signIn(form)
        toast('로그인했어요')
        nav('/my')
      } else {
        const { needsConfirm } = await signUp(form)
        if (needsConfirm) setNotice('가입 확인 메일을 보냈어요. 메일의 링크를 누른 뒤 로그인해 주세요.')
        else { toast('가입을 환영해요'); nav('/my') }
      }
    } catch (err) {
      setError(korean(err.message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="container">
      <div className="jp-auth jp-auth-split">
        <div className="jp-auth-visual" style={{ backgroundImage: 'url(/images/jeju-haenyeo.jpg)' }}>
          <div>
            <div className="jp-eyebrow mb-2" style={{ color: '#bfdbfe' }}>제주픽</div>
            <div className="fs-4 fw-bold lh-sm">내가 담은 제주,<br />다시 꺼내 보세요.</div>
          </div>
        </div>
        <div className="jp-auth-form">
        <div className="jp-eyebrow mb-2">내 여행 보관함</div>
        <h1 className="h4 fw-bold mb-1">{mode === 'in' ? '로그인' : '회원가입'}</h1>
        <p className="text-muted small mb-4">로그인하면 위시리스트와 AI가 만든 코스를 언제든 다시 볼 수 있어요.</p>

        {!isSupabaseReady && <div className="alert alert-warning small">Supabase 설정(<code>.env.local</code>)이 없어 로그인할 수 없어요.</div>}

        <button type="button" className="jp-kakao-btn" onClick={kakao} disabled={!isSupabaseReady}>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#191919" d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.87 5.33 4.69 6.75l-.95 3.5c-.08.3.26.54.52.37l4.16-2.77c.52.06 1.05.1 1.58.1 5.52 0 10-3.58 10-8S17.52 3 12 3z" /></svg>
          카카오로 시작하기
        </button>
        <div className="jp-or"><span>또는 이메일로</span></div>

        <div className="jp-tabs" role="tablist">
          <button type="button" className={`jp-tab ${mode === 'in' ? 'on' : ''}`} onClick={() => { setMode('in'); setError(''); setNotice('') }}>로그인</button>
          <button type="button" className={`jp-tab ${mode === 'up' ? 'on' : ''}`} onClick={() => { setMode('up'); setError(''); setNotice('') }}>회원가입</button>
        </div>

        <form onSubmit={submit} className="d-grid gap-3">
          {mode === 'up' && (
            <div>
              <label className="form-label small fw-semibold" htmlFor="name">이름 (표시용)</label>
              <input id="name" className="form-control" value={form.name} onChange={set('name')} maxLength={20} autoComplete="nickname" />
            </div>
          )}
          <div>
            <label className="form-label small fw-semibold" htmlFor="email">이메일</label>
            <input id="email" type="email" required className="form-control" value={form.email} onChange={set('email')} autoComplete="email" />
          </div>
          <div>
            <label className="form-label small fw-semibold" htmlFor="pw">비밀번호</label>
            <input id="pw" type="password" required minLength={6} className="form-control" value={form.password} onChange={set('password')}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
            {mode === 'up' && <div className="form-text">6자 이상</div>}
          </div>

          {error && <div className="alert alert-danger py-2 small mb-0">{error}</div>}
          {notice && <div className="alert alert-success py-2 small mb-0">{notice}</div>}

          <button className="btn btn-primary py-2" disabled={busy || !isSupabaseReady}>
            {busy ? '처리 중…' : mode === 'in' ? '로그인' : '가입하기'}
          </button>
        </form>
        </div>
      </div>
    </div>
  )
}
