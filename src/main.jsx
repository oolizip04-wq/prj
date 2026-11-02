import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

// 디자인: Bootstrap 5 + 우리 테마(styles/theme.css: 각진 흰색·잉크·파란색)
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap-icons/font/bootstrap-icons.css'
import 'leaflet/dist/leaflet.css'
import './styles/theme.css'

import { router } from './router'
import { useAppStore } from './store/useAppStore'

useAppStore.getState().initAuth()   // 저장된 로그인 복원
if (import.meta.env.DEV) window.__store = useAppStore   // 개발 중 콘솔에서 상태 확인용 (배포 빌드에는 없음)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
