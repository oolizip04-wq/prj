import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="text-center py-5">
      <div className="display-1 text-primary">404</div>
      <p className="lead">없는 페이지예요.</p>
      <Link to="/" className="btn btn-primary"><i className="bi bi-house me-1" />홈으로</Link>
    </div>
  )
}
