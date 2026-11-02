import { Button } from 'react-bootstrap'
import { COLOR, LABEL, km } from '../lib/parking'
import { useAppStore } from '../store/useAppStore'

// 선택한 주차장의 상세 정보 + 즐겨찾기 + 길찾기
export default function DetailCard({ p, onClose }) {
  const fav = useAppStore((s) => s.favorites.some((f) => f.id === p.id))
  const addFavorite = useAppStore((s) => s.addFavorite)
  const removeFavorite = useAppStore((s) => s.removeFavorite)
  const findRoute = useAppStore((s) => s.findRoute)

  const charge = p.basicCharge ? `${p.basicTime || '-'}분 ${Number(p.basicCharge).toLocaleString()}원` : (p.fee || '-')
  return (
    <div className="p-3 border-bottom position-relative">
      <button type="button" className="btn-close position-absolute top-0 end-0 m-3" aria-label="닫기" onClick={onClose} />
      <h5 className="fw-bold pe-4">{p.name}</h5>
      <span className="tag" style={{ background: COLOR[p.kind] }}>{LABEL[p.kind]}</span>
      {p.type && <span className="tag" style={{ background: '#5d6675' }}>{p.type}</span>}
      <dl className="row small mt-3 mb-2">
        <dt className="col-4 text-muted fw-normal">주소</dt><dd className="col-8">{p.addr || '-'}</dd>
        <dt className="col-4 text-muted fw-normal">주차면수</dt><dd className="col-8">{p.spaces || '-'}면</dd>
        <dt className="col-4 text-muted fw-normal">요금</dt>
        <dd className="col-8">{p.fee || '-'}{p.fee !== '무료' && p.basicCharge ? ` · 기본 ${charge}` : ''}</dd>
        {p.paidWindow ? (
          <>
            <dt className="col-4 text-muted fw-normal">유료 시간</dt>
            <dd className="col-8">평일 {p.paidWindow.start}~{p.paidWindow.end}만 유료<br />
              <b>{p.kind === 'free' ? '지금은 무료 시간' : '지금은 유료 시간'}</b> <span className="text-muted">(밤·주말 무료)</span></dd>
          </>
        ) : p.fee !== '무료' && (
          <>
            <dt className="col-4 text-muted fw-normal">요일 요금</dt>
            <dd className="col-8 text-muted">요일별 요금 정보 없음 (항상 유료로 표시)</dd>
          </>
        )}
        <dt className="col-4 text-muted fw-normal">운영시간</dt>
        <dd className="col-8">{p.weekdayOpen ? `${p.weekdayOpen} ~ ${p.weekdayClose} (평일)` : '-'}</dd>
        <dt className="col-4 text-muted fw-normal">전화</dt><dd className="col-8">{p.phone || '-'}</dd>
        {p.distanceM != null && (<><dt className="col-4 text-muted fw-normal">기준 거리</dt><dd className="col-8">{km(p.distanceM)}</dd></>)}
      </dl>
      <div className="d-grid gap-2">
        <Button variant={fav ? 'warning' : 'outline-dark'} onClick={() => (fav ? removeFavorite(p.id) : addFavorite(p))}>
          {fav ? <><span className="fav-star">★</span> 즐겨찾기</> : '☆ 즐겨찾기'}
        </Button>
        <Button variant="primary" onClick={() => findRoute(p)}><i className="bi bi-signpost-split me-1" />길찾기 (카페·맛집 보기)</Button>
        <a className="btn btn-outline-secondary btn-sm" target="_blank" rel="noopener noreferrer"
          href={`https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`}>구글 지도</a>
      </div>
    </div>
  )
}
