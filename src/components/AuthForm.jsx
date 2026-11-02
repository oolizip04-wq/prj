import { useState } from 'react'
import { Alert, Button, Card, Form } from 'react-bootstrap'
import { isSupabaseReady } from '../lib/supabase'
import { useAppStore } from '../store/useAppStore'

// 로그인 / 회원가입 카드 (이메일 + 비밀번호)
export default function AuthForm() {
  const signIn = useAppStore((s) => s.signIn)
  const signUp = useAppStore((s) => s.signUp)
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState(null)   // { text, ok }
  const [busy, setBusy] = useState(false)
  const signup = mode === 'signup'

  if (!isSupabaseReady) return <Alert variant="warning">.env.local 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 를 넣어야 로그인할 수 있어요.</Alert>

  async function submit(e) {
    e.preventDefault()
    if (signup && pw !== pw2) return setMsg({ text: '비밀번호가 서로 달라요' })
    setBusy(true); setMsg(null)
    try {
      if (signup) {
        const { needsConfirm } = await signUp(email.trim(), pw)
        if (needsConfirm) { setMode('login'); setMsg({ text: '가입 완료! 확인 메일의 링크를 누른 뒤 로그인해 주세요.', ok: true }) }
      } else await signIn(email.trim(), pw)
    } catch (err) { setMsg({ text: err.message }) } finally { setBusy(false) }
  }

  return (
    <Card className="mx-auto" style={{ maxWidth: 380 }}>
      <Card.Body>
        <Card.Title as="h4" className="fw-bold mb-3">{signup ? '회원가입' : '로그인'}</Card.Title>
        <Form onSubmit={submit} className="d-grid gap-2">
          <Form.Control type="email" placeholder="이메일" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Form.Control type="password" placeholder="비밀번호 (6자 이상)" minLength={6} required autoComplete={signup ? 'new-password' : 'current-password'} value={pw} onChange={(e) => setPw(e.target.value)} />
          {signup && <Form.Control type="password" placeholder="비밀번호 확인" required autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />}
          {msg && <div className={`small ${msg.ok ? 'text-success' : 'text-danger'}`}>{msg.text}</div>}
          <Button type="submit" disabled={busy}>{busy ? '잠시만요...' : signup ? '가입하기' : '로그인'}</Button>
          <Button variant="link" size="sm" type="button" onClick={() => { setMode(signup ? 'login' : 'signup'); setMsg(null) }}>
            {signup ? '이미 계정이 있어요 → 로그인' : '계정이 없어요 → 회원가입'}
          </Button>
        </Form>
      </Card.Body>
    </Card>
  )
}
