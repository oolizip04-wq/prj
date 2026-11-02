import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { Button, Form } from 'react-bootstrap'
import { get } from '../api/client'
import { COLOR, JEJU_AIRPORT, JEJU_BOUNDS, km, nowKST, sortedCafes, withKind } from '../lib/parking'
import { useAppStore } from '../store/useAppStore'
import ChatMessage from '../components/ChatMessage'
import DetailCard from '../components/DetailCard'
import FavBar from '../components/FavBar'
import RouteBox, { placeLabel } from '../components/RouteBox'
import '../styles/map.css'

const EXAMPLES = [
  '공항 근처 무료 주차장 알려줘',
  '서귀포 올레시장 가까운 주차장 3곳',
  '성산일출봉 근처에 100면 이상 주차장 있어?',
  '제주국제공항에서 성산일출봉 가는 길에 들를 만한 카페 알려줘',
]
const poiKey = (p) => `${p.name}|${p.lat}`

export default function MapPage() {
  const mapEl = useRef(null)
  const map = useRef(null)
  const pinLayer = useRef(null)
  const routeLayer = useRef(null)
  const poiMarkers = useRef(new Map())
  const meMarker = useRef(null)

  const [data, setData] = useState([])
  const [status, setStatus] = useState({ text: '불러오는 중...' })
  const [tick, setTick] = useState(0)
  const [filters, setFilters] = useState({ free: true, paid: true, mixed: true })
  const [selectedId, setSelectedId] = useState(null)
  const [notice, setNotice] = useState('')
  const [q, setQ] = useState('')
  const [dismissedAt, setDismissedAt] = useState(-1)

  const favorites = useAppStore((s) => s.favorites)
  const focus = useAppStore((s) => s.focus)
  const clearFocus = useAppStore((s) => s.clearFocus)
  const route = useAppStore((s) => s.route)
  const setRoute = useAppStore((s) => s.setRoute)
  const userLoc = useAppStore((s) => s.userLoc)
  const setUserLoc = useAppStore((s) => s.setUserLoc)
  const chat = useAppStore((s) => s.chat)
  const chatBusy = useAppStore((s) => s.chatBusy)
  const askAgent = useAppStore((s) => s.askAgent)

  // ── 지도 만들기 (한 번) ──
  useEffect(() => {
    const m = L.map(mapEl.current, { maxBounds: JEJU_BOUNDS, maxBoundsViscosity: 1, minZoom: 9 }).setView([33.38, 126.55], 10)
    m.attributionControl.setPrefix(false)
    // HOT 스타일: 같은 OpenStreetMap 데이터인데 오름(봉우리) 삼각형 표시가 없음
    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      subdomains: 'abc', maxZoom: 19, minZoom: 9, bounds: L.latLngBounds(JEJU_BOUNDS), attribution: '© OpenStreetMap contributors, Tiles: HOT, OSM France',
    }).addTo(m)
    pinLayer.current = L.layerGroup().addTo(m)
    routeLayer.current = L.layerGroup().addTo(m)
    // 확대할수록 핀도 조금씩 커짐 (줌 10 → 8px, 한 단계마다 +1.6px, 최대 26px)
    const sizePins = () => mapEl.current?.style.setProperty('--pin', Math.max(6, Math.min(26, 8 + (m.getZoom() - 10) * 1.6)) + 'px')
    m.on('zoomend', sizePins); sizePins()
    // 위치를 못 쓸 때: 지도 오른쪽 클릭으로 출발지 지정
    m.on('contextmenu', (e) => { useAppStore.getState().setUserLoc({ lat: +e.latlng.lat.toFixed(5), lng: +e.latlng.lng.toFixed(5), label: '출발지' }); m.panTo(e.latlng) })
    map.current = m
    setTimeout(() => m.invalidateSize(), 0)
    return () => { m.remove(); map.current = null; meMarker.current = null }
  }, [])

  // ── 데이터 불러오기 + 1분마다 무료/유료 다시 계산(시간제 주차장 대상) ──
  useEffect(() => {
    get('/api/parking')
      .then((j) => {
        if (!j.items?.length) throw new Error('제주 데이터가 0건이에요')
        setData(j.items); setStatus({ text: `실제 데이터 ${j.items.length}곳` })
      })
      .catch((e) => setStatus({ text: `데이터를 불러오지 못했어요 — ${e.message}`, warn: true }))
    const id = setInterval(() => setTick((t) => t + 1), 60000)
    return () => clearInterval(id)
  }, [])

  const now = useMemo(() => nowKST(), [tick]) // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => data.map((p) => withKind(p, now)), [data, now])
  const counts = useMemo(() => ({ free: 0, paid: 0, mixed: 0, ...Object.fromEntries(['free', 'paid', 'mixed'].map((k) => [k, rows.filter((p) => p.kind === k).length])) }), [rows])
  const favIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites])

  // 길찾기 중이면 목적지만, AI 결과가 있으면 그것만, 아니면 필터에 맞는 전체
  const visible = useMemo(() => {
    if (route?.dest) return [withKind(route.dest, now)]
    if (focus) return focus.map((p) => withKind(p, now))
    return rows.filter((p) => filters[p.kind] ?? true)
  }, [route, focus, rows, filters, now])
  const selected = selectedId && (visible.find((p) => p.id === selectedId) ?? favorites.map((p) => withKind(p, now)).find((p) => p.id === selectedId))

  // ── 핀 그리기 ──
  useEffect(() => {
    const layer = pinLayer.current
    if (!layer) return
    layer.clearLayers()
    const numbered = Boolean(focus) && !route?.dest   // AI 검색 결과가 여러 곳이면 번호를 붙임
    visible.forEach((p, idx) => {
      const fav = favIds.has(p.id), sel = p.id === selectedId
      const html = numbered ? `<div class="numpin${fav ? ' fav' : ''}${sel ? ' sel' : ''}" style="background:${COLOR[p.kind]}">${idx + 1}</div>` : fav ? `<div class="star${sel ? ' sel' : ''}">★</div>` : `<div class="pin${sel ? ' sel' : ''}" style="background:${COLOR[p.kind]}"></div>`
      L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html, iconSize: [0, 0], iconAnchor: [0, 0] }), zIndexOffset: fav ? 1000 : 0 })
        .on('click', () => setSelectedId(p.id)).addTo(layer)
    })
  }, [visible, favIds, selectedId, focus, route?.dest])

  // ── 내 위치 / 출발지 표시 ──
  useEffect(() => {
    meMarker.current?.remove(); meMarker.current = null
    if (!userLoc || !map.current) return
    meMarker.current = L.marker([userLoc.lat, userLoc.lng], {
      icon: L.divIcon({ className: '', html: `<div class="me"><s></s><s></s><i></i><b></b></div>`, iconSize: [0, 0] }), zIndexOffset: 5000, interactive: false,
    }).addTo(map.current)
    meMarker.current.getElement().querySelector('b').textContent = userLoc.label   // 이름은 textContent 로 (HTML 주입 방지)
  }, [userLoc])

  const locate = useCallback(() => {
    const fallback = (why) => {
      setUserLoc({ ...JEJU_AIRPORT, label: '임시 출발지(제주공항)' })
      setNotice(`${why} → 지도를 오른쪽 클릭하면 출발지를 바꿀 수 있어요`)
      map.current?.setView([JEJU_AIRPORT.lat, JEJU_AIRPORT.lng], 12)
    }
    if (!navigator.geolocation) return fallback('이 브라우저는 위치를 지원하지 않아요')
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: la, longitude: ln } = pos.coords
      if (!L.latLngBounds(JEJU_BOUNDS).contains([la, ln])) return fallback('현재 위치가 제주 밖이에요')
      setNotice('')
      setUserLoc({ lat: +la.toFixed(5), lng: +ln.toFixed(5), label: '내 위치' })
      map.current?.setView([la, ln], 13)
    }, (err) => fallback(err.code === 1 ? '위치 권한이 꺼져 있어요' : '위치를 가져오지 못했어요'), { timeout: 10000 })
  }, [setUserLoc])

  // 처음 들어오면 내 위치를 찾아 표시 (이미 있으면 그 위치로 이동만)
  useEffect(() => {
    const u = useAppStore.getState().userLoc
    if (u) map.current?.setView([u.lat, u.lng], 12)
    else locate()
  }, [locate])

  // ── AI 가 찾아 준 주차장으로 지도 이동 ──
  useEffect(() => {
    if (!focus || useAppStore.getState().route || !map.current) return
    const pts = focus.filter((p) => p.lat && p.lng)
    if (pts.length) map.current.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng])).pad(0.3), { maxZoom: 15 })
  }, [focus])

  // ── 경로선 + 경로 주변 카페·맛집 점 ──
  useEffect(() => {
    const layer = routeLayer.current
    if (!layer) return
    layer.clearLayers(); poiMarkers.current.clear()
    const r = route?.route
    if (!r) return
    const line = L.polyline(r.coords, { color: '#1a73e8', weight: 5, opacity: 0.85 }).addTo(layer)
    sortedCafes(route.places).forEach((p, i) => {
      const mk = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: `<div class="numpin cafe">${i + 1}</div>`, iconSize: [0, 0] }), zIndexOffset: 800 }).addTo(layer)
      mk.bindTooltip(`${i + 1}. ${p.name} · ${placeLabel(p.kind)} · 출발지에서 ${p.alongKm}km 지점`)
      poiMarkers.current.set(poiKey(p), mk)
    })
    map.current.fitBounds(line.getBounds().pad(0.15))
  }, [route])

  const pickPoi = (p) => { map.current?.setView([p.lat, p.lng], Math.max(map.current.getZoom(), 15)); poiMarkers.current.get(poiKey(p))?.openTooltip() }
  const pickParking = (p) => { map.current?.setView([p.lat, p.lng], 16); setSelectedId(p.id) }
  const submit = (text) => { if (text.trim() && !chatBusy) { setQ(text); setSelectedId(null); askAgent(text.trim()) } }   // 새 검색이면 선택된 주차장도 닫음

  const last = chat[chat.length - 1]
  const showAnswer = last?.role === 'assistant' && dismissedAt !== chat.length

  return (
    <div className="d-flex flex-column flex-grow-1" style={{ minHeight: 0 }}>
      <div className="bg-white border-bottom px-3 py-2">
        <div className="d-flex flex-wrap align-items-center gap-3 mb-2 small">
          {[['free', '무료'], ['paid', '유료'], ['mixed', '일부 유료']].map(([k, label]) => (
            <Form.Check key={k} inline className="m-0" id={`f-${k}`} checked={filters[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.checked })}
              label={<><span className="dot" style={{ background: COLOR[k] }} />{label} <span className="text-muted">({counts[k]})</span></>} />
          ))}
          <span className={`ms-auto ${status.warn ? 'text-danger' : 'text-muted'}`}>{status.text} · 기준 {now.label}</span>
        </div>
        <Form className="d-flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(q) }}>
          <Form.Control size="sm" value={q} onChange={(e) => setQ(e.target.value)} placeholder="AI에게 물어보세요 — 예: 공항 근처 무료 주차장 알려줘" autoComplete="off" />
          <Button type="submit" size="sm" variant="dark" disabled={chatBusy} className="text-nowrap">{chatBusy ? '검색 중...' : 'AI 검색'}</Button>
          <Button type="button" size="sm" variant={userLoc ? 'primary' : 'outline-dark'} className={`text-nowrap ${userLoc ? 'btn-me' : ''}`} onClick={locate}>
            <i className="bi bi-crosshair me-1" />{userLoc ? `${userLoc.label} ✓` : '내 위치'}
          </Button>
        </Form>
        <div className="small mt-1 d-flex flex-wrap gap-2">
          <span className="text-muted">예시:</span>
          {EXAMPLES.map((t) => <a key={t} role="button" className="border px-2 text-decoration-none text-dark" onClick={() => submit(t)}>{t.length > 14 ? t.slice(0, 14) + '…' : t}</a>)}
        </div>
        {notice && <div className="small text-warning-emphasis mt-1">{notice}</div>}
      </div>

      {showAnswer && (
        <div className="chat-box border-bottom px-3 pt-2 position-relative" style={{ background: '#f5f7ff', maxHeight: '22vh', overflowY: 'auto' }}>
          <button type="button" className="btn-close position-absolute top-0 end-0 m-2" aria-label="닫기" onClick={() => setDismissedAt(chat.length)} />
          <ChatMessage m={last} />
        </div>
      )}

      <div className="map-body d-flex flex-grow-1" style={{ minHeight: 0 }}>
        <div ref={mapEl} className="map-wrap flex-grow-1" />
        <aside className="side-panel">
          <RouteBox onPick={pickPoi} />
          {selected ? (
            <DetailCard p={selected} onClose={() => setSelectedId(null)} />   /* 하나를 고르면 나머지 목록은 숨김 */
          ) : (
            <div>
              {route?.dest && (
                <div className="focusbar"><span>🚗 길찾기 중 — 목적지만 표시</span><Button size="sm" variant="outline-light" onClick={() => setRoute(null)}>모든 주차장 보기</Button></div>
              )}
              {focus && !route?.dest && (
                <div className="focusbar"><span>🔎 AI 검색 결과 {focus.length}곳</span><Button size="sm" variant="outline-light" onClick={clearFocus}>전체 보기</Button></div>
              )}
              {visible.map((p, idx) => (
                <div key={p.id} className="p-row" onClick={() => pickParking(p)}>
                  <b>{focus && !route?.dest ? <span className="numbadge" style={{ background: COLOR[p.kind] }}>{idx + 1}</span> : favIds.has(p.id) ? <span className="fav-star me-1">★</span> : <span className="dot" style={{ background: COLOR[p.kind] }} />}{focus && !route?.dest && favIds.has(p.id) && <span className="fav-star me-1">★</span>}{p.name}</b>
                  <span className="meta">{p.addr} · {p.spaces || '-'}면{p.fee ? ` · ${p.fee}` : ''}{focus && p.distanceM != null ? ` · ${km(p.distanceM)}` : ''}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      <FavBar onPick={pickParking} />
    </div>
  )
}
