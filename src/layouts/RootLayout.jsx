import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Button, Container, Nav, Navbar, Toast, ToastContainer } from 'react-bootstrap'
import { NAV_ITEMS } from '../router'
import { useAppStore } from '../store/useAppStore'

export default function RootLayout() {
  const toasts = useAppStore((s) => s.toasts)
  const user = useAppStore((s) => s.user)
  const signOut = useAppStore((s) => s.signOut)
  const { pathname } = useLocation()
  const isIntro = pathname === '/'      // 첫 화면은 메뉴 없이 전체 화면 연출
  const isMap = pathname === '/map'     // 지도 화면은 화면 전체를 씀

  if (isIntro) return <Outlet />

  return (
    <div className={`d-flex flex-column ${isMap ? 'vh-100' : 'min-vh-100'}`}>
      <Navbar expand="md" bg="dark" data-bs-theme="dark" collapseOnSelect sticky="top">
        <Container fluid={isMap}>
          <Navbar.Brand as={NavLink} to="/">
            <i className="bi bi-p-square-fill me-2" />제주 주차장 지도
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="main-nav" />
          <Navbar.Collapse id="main-nav">
            <Nav className="me-auto">
              {NAV_ITEMS.map((item) => (
                <Nav.Link key={item.to} as={NavLink} to={item.to} end={item.to === '/'} eventKey={item.to}>
                  <i className={`bi bi-${item.icon} me-1`} />{item.label}
                </Nav.Link>
              ))}
            </Nav>
            {user && (
              <div className="d-flex align-items-center gap-2 text-white-50 small">
                <i className="bi bi-person-circle" />{user.email}
                <Button size="sm" variant="outline-light" onClick={signOut}>로그아웃</Button>
              </div>
            )}
          </Navbar.Collapse>
        </Container>
      </Navbar>

      {isMap ? (
        <main className="flex-grow-1 d-flex flex-column" style={{ minHeight: 0 }}><Outlet /></main>
      ) : (
        <>
          <main className="flex-grow-1 py-4">
            <Container><Outlet /></Container>
          </main>
          <footer className="py-3 border-top bg-white">
            <Container className="small text-muted">
              제주대 청년도약 부트캠프 1기 · 데이터 출처: 공공데이터포털(주차장·TourAPI), OpenStreetMap, OSRM
            </Container>
          </footer>
        </>
      )}

      <ToastContainer position="bottom-end" className="p-3 position-fixed">
        {toasts.map((t) => (
          <Toast key={t.id} bg={t.variant}>
            <Toast.Body className="text-white">{t.message}</Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
    </div>
  )
}
