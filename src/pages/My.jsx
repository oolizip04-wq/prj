import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, Col, Row } from 'react-bootstrap'
import PageHeader from '../components/PageHeader'
import { Empty, Loading } from '../components/Status'
import { COLOR, LABEL, feeKind } from '../lib/parking'
import { useAppStore } from '../store/useAppStore'

// 내 즐겨찾기: 로그인한 계정에 저장된 주차장 (Supabase favorites 테이블)
export default function My() {
  const favorites = useAppStore((s) => s.favorites)
  const loading = useAppStore((s) => s.favLoading)
  const loadFavorites = useAppStore((s) => s.loadFavorites)
  const removeFavorite = useAppStore((s) => s.removeFavorite)

  useEffect(() => { loadFavorites() }, [loadFavorites])

  return (
    <>
      <PageHeader icon="star-fill" title="내 즐겨찾기" subtitle="지도에서 ☆ 를 눌러 담은 주차장이에요. 내 계정에만 보여요." />
      {loading && !favorites.length ? <Loading /> : !favorites.length ? (
        <Empty text="아직 담은 주차장이 없어요">
          <Button as={Link} to="/map" variant="primary" size="sm" className="mt-2">지도에서 찾아보기</Button>
        </Empty>
      ) : (
        <Row xs={1} md={2} lg={3} className="g-3">
          {favorites.map((p) => {
            const kind = p.fee ? feeKind(p) : 'unknown'
            return (
              <Col key={p.id}>
                <Card className="h-100">
                  <Card.Body>
                    <Card.Title className="fs-6 fw-bold"><span className="fav-star me-1">★</span>{p.name}</Card.Title>
                    <Badge style={{ background: COLOR[kind] }} className="me-1">{LABEL[kind]}</Badge>
                    {p.type && <Badge bg="secondary">{p.type}</Badge>}
                    <div className="small text-muted mt-2">{p.addr || '-'}</div>
                    <div className="small">{p.spaces ? `${p.spaces}면` : ''}{p.fee ? ` · ${p.fee}` : ''}</div>
                  </Card.Body>
                  <Card.Footer className="bg-white"><Button size="sm" variant="outline-danger" onClick={() => removeFavorite(p.id)}>삭제</Button></Card.Footer>
                </Card>
              </Col>
            )
          })}
        </Row>
      )}
    </>
  )
}
