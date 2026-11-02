import { Alert, Spinner } from 'react-bootstrap'

// 데이터·로딩·에러 3종 세트를 화면에 보여주는 공용 컴포넌트
export function Loading({ text = '불러오는 중...' }) {
  return <div className="text-center py-5 text-muted"><Spinner animation="border" size="sm" className="me-2" />{text}</div>
}
export function ErrorAlert({ error }) {
  if (!error) return null
  return <Alert variant="danger"><i className="bi bi-exclamation-triangle me-2" />{String(error)}</Alert>
}
export function Empty({ text = '결과가 없어요', children }) {
  return <div className="text-center py-5 text-muted"><i className="bi bi-inbox fs-2 d-block mb-2" />{text}{children && <div>{children}</div>}</div>
}
