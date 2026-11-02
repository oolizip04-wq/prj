import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuthForm from '../components/AuthForm'
import { useAppStore } from '../store/useAppStore'
import '../styles/intro.css'

const VIDEO = '/intro/intro.mp4'
const POSTER = '/intro/poster.jpg'

// 첫 화면: 블렌더로 만든 영상(귤 자동차가 달려와 주차) → "주차장 찾기" 버튼 → 스르륵 로그인 → 지도
export default function Intro() {
  const navigate = useNavigate()
  const user = useAppStore((s) => s.user)
  const video = useRef(null)
  const [ready, setReady] = useState(false)       // 영상이 끝나 버튼이 나타났는지
  const [stage, setStage] = useState('intro')     // intro | login | out(로그인돼 있어 바로 지도로)

  // 움직임 줄이기 설정이면 영상을 멈추고 바로 마지막 화면(포스터)과 버튼
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setReady(true); video.current?.pause() }
  }, [])
  // 영상이 거의 끝나면 버튼 등장
  const onTime = () => {
    const v = video.current
    if (v && v.duration && v.currentTime > v.duration - 0.5) setReady(true)
  }

  // 로그인이 되면 지도로
  useEffect(() => { if (stage === 'login' && user) navigate('/map') }, [stage, user, navigate])

  const begin = () => {
    if (user) { setStage('out'); setTimeout(() => navigate('/map'), 750) } else setStage('login')
  }
  const back = () => setStage('intro')
  const skip = () => { const v = video.current; if (v && v.duration) v.currentTime = v.duration; setReady(true) }

  return (
    <div className={`intro ${stage === 'out' ? 'is-out' : ''}`}>
      <div className={`intro-canvas ${stage === 'login' ? 'dim' : ''}`}>
        <video
          ref={video} className="intro-video" src={VIDEO} poster={POSTER}
          autoPlay muted playsInline preload="auto"
          onTimeUpdate={onTime} onEnded={() => setReady(true)} onError={() => setReady(true)}
        />
      </div>

      {!ready && stage === 'intro' && <button type="button" className="intro-skip" onClick={skip}>SKIP ›</button>}

      <div className={`intro-layer intro-main ${!ready ? 'wait' : ''} ${stage !== 'intro' ? 'out' : ''}`}>
        <div className="intro-head">
          <div className="intro-eyebrow">JEJU PARKING MAP</div>
          <h1 className="intro-title">주차부터 시작되는<br />제주 여행</h1>
          <p className="intro-sub">공영주차장 찾기부터 가는 길의 카페까지</p>
        </div>
        <button type="button" className="intro-cta" onClick={begin}>
          <span>주차장 찾기</span><i className="bi bi-arrow-right" />
        </button>
      </div>

      <div className={`intro-layer intro-login ${stage === 'login' ? 'in' : ''}`}>
        <div className="login-box">
          <div className="intro-eyebrow">WELCOME</div>
          <h2 className="login-title">로그인하고 지도를 열어요</h2>
          <AuthForm />
          <button type="button" className="login-back" onClick={back}><i className="bi bi-arrow-left" /> 돌아가기</button>
        </div>
      </div>
    </div>
  )
}
