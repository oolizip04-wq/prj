import { createBrowserRouter } from 'react-router-dom'
import RootLayout from './layouts/RootLayout'
import RequireAuth from './components/RequireAuth'
import Home from './pages/Home'
import Intro from './pages/Intro'
import MapPage from './pages/MapPage'
import Agent from './pages/Agent'
import My from './pages/My'
import NotFound from './pages/NotFound'

// 페이지 추가: ① pages/ 에 파일 ② NAV_ITEMS 한 줄 ③ routes 한 줄
export const NAV_ITEMS = [
  { to: '/map', label: '주차장 지도', icon: 'geo-alt' },
  { to: '/agent', label: 'AI 가이드', icon: 'robot' },
  { to: '/my', label: '내 즐겨찾기', icon: 'star' },
  { to: '/about', label: '소개', icon: 'info-circle' },
]

const guard = (page) => <RequireAuth>{page}</RequireAuth>

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Intro /> },   // 첫 화면: 위성 → 주차 연출 → 시작 버튼 → 로그인
      { path: 'map', element: guard(<MapPage />) },
      { path: 'about', element: <Home /> },
      { path: 'agent', element: guard(<Agent />) },
      { path: 'my', element: guard(<My />) },
    ],
  },
])
