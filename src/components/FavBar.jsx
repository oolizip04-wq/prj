import { Button } from 'react-bootstrap'
import { useAppStore } from '../store/useAppStore'

// 화면 맨 아래 즐겨찾기 줄 (황금색 별)
export default function FavBar({ onPick }) {
  const favorites = useAppStore((s) => s.favorites)
  const removeFavorite = useAppStore((s) => s.removeFavorite)
  const clearFavorites = useAppStore((s) => s.clearFavorites)
  return (
    <footer className="fav-bar">
      <div className="d-flex align-items-center gap-2 mb-1">
        <b className="small">⭐ 즐겨찾기 ({favorites.length})</b>
        {favorites.length > 0 && <Button size="sm" variant="outline-secondary" className="ms-auto py-0" onClick={clearFavorites}>모두 비우기</Button>}
      </div>
      <div className="d-flex gap-2 overflow-auto" style={{ minHeight: 34 }}>
        {favorites.length === 0 && <span className="small text-muted">지도의 주차장을 눌러 상세 카드의 ☆ 즐겨찾기 버튼을 눌러 보세요.</span>}
        {favorites.map((p) => (
          <div key={p.id} className="fav-card" onClick={() => onPick(p)}>
            <b><span className="fav-star">★</span> {p.name}</b>
            <div className="text-muted text-truncate">{p.addr}</div>
            <button type="button" className="rm" title="삭제" onClick={(e) => { e.stopPropagation(); removeFavorite(p.id) }}>×</button>
          </div>
        ))}
      </div>
    </footer>
  )
}
