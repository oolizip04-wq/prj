import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, Form } from 'react-bootstrap'
import PageHeader from '../components/PageHeader'
import ChatMessage from '../components/ChatMessage'
import { useAppStore } from '../store/useAppStore'

const EXAMPLES = [
  '공항 근처 무료 주차장 알려줘',
  '성산일출봉 근처에 100면 이상 주차장 있어?',
  '제주국제공항에서 성산일출봉 가는 길에 들를 만한 카페 알려줘',
  '서귀포 올레시장에서 가까운 주차장 3곳과 차로 걸리는 시간',
]

// AI 가이드: 자연어로 묻고, 에이전트가 어떤 도구를 불렀는지(도구 호출 로그)까지 보여줌
export default function Agent() {
  const chat = useAppStore((s) => s.chat)
  const busy = useAppStore((s) => s.chatBusy)
  const askAgent = useAppStore((s) => s.askAgent)
  const userLoc = useAppStore((s) => s.userLoc)
  const hasMapResult = useAppStore((s) => Boolean(s.focus || s.route))
  const [q, setQ] = useState('')
  const end = useRef(null)

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [chat, busy])

  const send = (text) => {
    const t = text.trim()
    if (!t || busy) return
    setQ(''); askAgent(t)
  }

  return (
    <>
      <PageHeader icon="robot" title="AI 가이드" subtitle="주차장·장소·길을 자연어로 물어보세요. AI가 공공데이터 도구를 직접 골라 부릅니다." />
      <div className="chat-box mb-3" style={{ minHeight: 260 }}>
        {chat.length === 0 && (
          <div className="text-muted">
            <p className="mb-2">이렇게 물어볼 수 있어요{userLoc ? '' : ' ("내 근처" 질문은 지도 화면에서 내 위치를 먼저 정해 주세요)'}:</p>
            <div className="d-flex flex-wrap gap-2">
              {EXAMPLES.map((t) => <Button key={t} size="sm" variant="outline-dark" onClick={() => send(t)}>{t}</Button>)}
            </div>
          </div>
        )}
        {chat.map((m, i) => <ChatMessage key={i} m={m} openLog={i === chat.length - 1} />)}
        {busy && <div className="msg assistant text-muted">도구를 부르는 중...</div>}
        <div ref={end} />
      </div>

      <Form className="d-flex gap-2" onSubmit={(e) => { e.preventDefault(); send(q) }}>
        <Form.Control value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: 섭지코지 근처 지금 무료 주차장 알려줘" autoComplete="off" />
        <Button type="submit" variant="dark" disabled={busy} className="text-nowrap">보내기</Button>
      </Form>
      {hasMapResult && <p className="small mt-2"><Link to="/map"><i className="bi bi-geo-alt me-1" />찾은 결과를 지도에서 보기</Link></p>}
    </>
  )
}
