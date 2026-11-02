import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Col, Row } from 'react-bootstrap'
import { ping } from '../api/client'
import { isSupabaseReady, supabase } from '../lib/supabase'
import Jeju3D from '../components/Jeju3D'

// 홈 = 서비스 소개 + 3D 제주 + 동작 체크
export default function Home() {
  const [db, setDb] = useState(isSupabaseReady
    ? { state: 'wait', msg: '확인 중...' }
    : { state: 'fail', msg: '.env.local 에 VITE_SUPABASE_URL / ANON_KEY 를 넣으세요' })
  const [api, setApi] = useState({ state: 'wait', msg: '확인 중...' })

  useEffect(() => {
    if (isSupabaseReady) {
      // 로그인 전에도 연결만 확인 (RLS 때문에 빈 결과여도 연결은 OK)
      supabase.from('favorites').select('id').limit(1).then(({ error }) =>
        setDb(error ? { state: 'fail', msg: error.message } : { state: 'ok', msg: '연결 OK' }))
    }
    ping()
      .then((d) => setApi({ state: 'ok', msg: `OK · 공공데이터 키 ${d.hasDataKey ? '있음' : '없음'} · Claude 키 ${d.hasClaudeKey ? '있음' : '없음'}` }))
      .catch(() => setApi({ state: 'fail', msg: '서버 함수(/api)에 연결하지 못했어요' }))
  }, [])

  return (
    <>
      <section className="hero p-4 p-md-5 mb-4">
        <Badge bg="light" text="dark" className="mb-3">제주 콘텐츠·문화 IP</Badge>
        <h1 className="fw-bold">제주 주차장 지도</h1>
        <p className="lead">공영주차장을 지도에서 찾고, 목적지까지 가는 길의 카페까지 한 번에. 자연어로 물어보면 AI가 공공데이터를 직접 찾아 답해요.</p>
        <Button as={Link} to="/map" variant="primary" className="me-2"><i className="bi bi-geo-alt me-1" />지도 열기</Button>
        <Button as={Link} to="/agent" variant="outline-light"><i className="bi bi-robot me-1" />AI에게 물어보기</Button>
      </section>

      <Card className="mb-4 overflow-hidden">
        <Jeju3D />
      </Card>

      <h5 className="fw-bold mb-3"><i className="bi bi-clipboard-check me-2" />동작 체크</h5>
      <Row xs={1} md={3} className="g-3">
        <Col><Check title="React · 라우터" state="ok" msg="이 화면이 보이면 OK" /></Col>
        <Col><Check title="Supabase" {...db} /></Col>
        <Col><Check title="서버 함수 /api" {...api} /></Col>
      </Row>
    </>
  )
}

function Check({ title, state, msg }) {
  const icon = { ok: 'check-circle-fill text-success', fail: 'x-circle-fill text-danger', wait: 'hourglass-split text-muted' }[state]
  return (
    <Card className="h-100">
      <Card.Body>
        <div className="fw-bold mb-1"><i className={`bi bi-${icon} me-2`} />{title}</div>
        <div className="small text-muted">{msg}</div>
      </Card.Body>
    </Card>
  )
}
