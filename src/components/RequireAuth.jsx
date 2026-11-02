import { Container } from 'react-bootstrap'
import { useAppStore } from '../store/useAppStore'
import AuthForm from './AuthForm'
import { Loading } from './Status'

// 로그인해야 볼 수 있는 페이지를 감쌉니다. 로그인 전에는 로그인 카드만 보여줌
export default function RequireAuth({ children }) {
  const user = useAppStore((s) => s.user)
  const authReady = useAppStore((s) => s.authReady)
  if (!authReady) return <Loading text="로그인 확인 중..." />
  if (user) return children
  return (
    <Container className="py-5">
      <p className="text-center text-muted mb-4">로그인하면 내 위치 주변 주차장 지도를 볼 수 있어요</p>
      <AuthForm />
    </Container>
  )
}
