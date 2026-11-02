import { Button } from 'react-bootstrap'
import { sortedCafes } from '../lib/parking'
import { useAppStore } from '../store/useAppStore'

const PLACE_LABEL = { cafe: '카페', restaurant: '음식점', fast_food: '패스트푸드' }
const SOURCE = { sbiz: '소상공인 상가정보', 'sbiz-saved': '소상공인 상가정보', local: '전국카페표준데이터(서귀포시)', 'local+tour': '전국카페표준데이터(서귀포시)+한국관광공사', tour: '한국관광공사' }
export const placeLabel = (k) => PLACE_LABEL[k] || '음식점'

// 경로 요약 + 경로 주변 카페·맛집 목록 (출발지에서 몇 km 지점인지)
export default function RouteBox({ onPick }) {
  const r = useAppStore((s) => s.route)
  const setRoute = useAppStore((s) => s.setRoute)
  if (!r) return null

  const clear = <Button size="sm" variant="outline-secondary" className="float-end" onClick={() => setRoute(null)}>경로 지우기</Button>
  if (r.loading) return <div className="p-3 border-bottom bg-light small text-muted">경로와 주변 카페·맛집을 찾는 중...</div>
  if (r.error) return <div className="p-3 border-bottom bg-light small text-danger">{clear}길찾기 실패: {r.error}</div>

  const places = sortedCafes(r.places)
  return (
    <div className="p-3 border-bottom" style={{ background: '#f5f9ff' }}>
      {clear}
      <h6 className="fw-bold mb-1">{r.title}</h6>
      <div className="small text-muted mb-2">
        차로 약 {r.route.minutes}분 · {r.route.km}km · 경로 주변 카페 {(r.places || []).length}곳 (거리는 출발지부터 경로를 따라 잰 값)
      </div>
      {r.placesError && <div className="small text-danger">카페·맛집 검색에 실패했어요: {r.placesError}</div>}
      {!r.placesError && !places.length && <div className="small text-muted py-2">경로 근처에서 찾지 못했어요</div>}
      {places.map((p, i) => (
        <div key={`${p.name}|${p.lat}`} className="d-flex gap-2 align-items-baseline border-top py-1 small" role="button" onClick={() => onPick(p)}>
          <span className="numbadge cafe">{i + 1}</span>
          <b>{p.name}</b>
          <small className="ms-auto text-muted text-nowrap">{placeLabel(p.kind)} · 출발지에서 {p.alongKm}km 지점</small>
        </div>
      ))}
      <div className="small text-muted mt-2">※ {SOURCE[r.placesSource] || '공공데이터'} 기준이라 별점·영업시간은 몰라요. 방문 전 확인하세요.</div>
    </div>
  )
}
