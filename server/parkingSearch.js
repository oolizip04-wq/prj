// 에이전트가 쓰는 주차장 검색 도구 (순수 함수 — 데이터 배열을 받아 걸러서 돌려줌)

// 대표 장소 좌표 (대략값). "공항 근처" 같은 질문에서 기준점으로 사용
export const LANDMARKS = {
  제주국제공항: [33.5104, 126.4914],
  제주시청: [33.4996, 126.5312],
  동문시장: [33.5128, 126.5288],
  용두암: [33.5160, 126.5120],
  서귀포시청: [33.2541, 126.5601],
  서귀포매일올레시장: [33.2487, 126.5636],
  천지연폭포: [33.2470, 126.5550],
  중문관광단지: [33.2480, 126.4120],
  협재해수욕장: [33.3940, 126.2390],
  애월: [33.4620, 126.3310],
  함덕해수욕장: [33.5430, 126.6690],
  성산일출봉: [33.4585, 126.9425],
  성판악: [33.3850, 126.6240],
}

const rad = (d) => (d * Math.PI) / 180
// 한국 시각 기준 현재 요일·분 (서버가 어느 시간대에 있어도 같은 결과)
export function nowKST(date = new Date()) {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]))
  return { weekend: p.weekday === 'Sat' || p.weekday === 'Sun', min: (Number(p.hour) % 24) * 60 + Number(p.minute), label: `${{ Mon: '월', Tue: '화', Wed: '수', Thu: '목', Fri: '금', Sat: '토', Sun: '일' }[p.weekday]} ${p.hour.padStart(2, '0')}:${p.minute}` }
}
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }

// 지금 무료인가? 무료 주차장이거나, '평일 유료시간 이외 무료' 주차장이 지금 그 시간 밖일 때
export function isFreeNow(p, now = nowKST()) {
  if (p.fee === '무료') return true
  if (p.paidWindow) return now.weekend || now.min < toMin(p.paidWindow.start) || now.min >= toMin(p.paidWindow.end)
  return false
}

export function distanceM(lat1, lng1, lat2, lng2) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2
  return Math.round(6371000 * 2 * Math.asin(Math.sqrt(a)))
}

// 검색 조건: keyword(이름·주소, 공백으로 여러 단어=모두 포함), near(장소명) 또는 lat/lng, freeOnly, minSpaces, type, limit
export function searchParking(items, args = {}, userLoc = null) {
  const { keyword = '', near, lat, lng, freeOnly = false, paidOnly = false, minSpaces = 0, type, limit = 10 } = args
  const now = nowKST()
  const words = String(keyword).split(/\s+/).filter(Boolean)

  let origin = null
  if (near && LANDMARKS[near]) origin = LANDMARKS[near]
  else if (Number.isFinite(lat) && Number.isFinite(lng)) origin = [lat, lng]
  else if (userLoc) origin = [userLoc.lat, userLoc.lng]

  let rows = items.filter((p) => {
    const text = `${p.name} ${p.addr}`
    if (!words.every((w) => text.includes(w))) return false
    if (freeOnly && !isFreeNow(p, now)) return false
    if (paidOnly && isFreeNow(p, now)) return false
    if (p.spaces < minSpaces) return false
    if (type && p.type !== type) return false
    return true
  })
  if (origin) {
    rows = rows.map((p) => ({ ...p, distanceM: distanceM(origin[0], origin[1], p.lat, p.lng) }))
    rows.sort((a, b) => a.distanceM - b.distanceM)
  } else {
    rows.sort((a, b) => b.spaces - a.spaces)
  }
  const n = Math.min(Math.max(Number(limit) || 10, 1), 20)
  return { now: now.label, total: rows.length, usedOrigin: Boolean(origin), results: rows.slice(0, n).map((p) => ({ ...p, freeNow: isFreeNow(p, now) })) }
}
