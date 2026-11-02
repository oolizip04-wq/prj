// 주차장 화면 공용 규칙: 요금 구분(무료/유료/일부 유료)과 색 — 한국 시각 기준으로 지금 무료인지까지 계산
export const COLOR = { free: '#4aa0e6', paid: '#d9363e', mixed: '#f07f1c', unknown: '#8b93a1' }
export const LABEL = { free: '무료', paid: '유료', mixed: '일부 유료', unknown: '요금 미상' }

// 한국 시각 기준 지금 요일·분
export function nowKST() {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
  const q = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]))
  const ko = { Mon: '월', Tue: '화', Wed: '수', Thu: '목', Fri: '금', Sat: '토', Sun: '일' }[q.weekday]
  return { weekend: q.weekday === 'Sat' || q.weekday === 'Sun', min: (Number(q.hour) % 24) * 60 + Number(q.minute), label: `${ko} ${q.hour.padStart(2, '0')}:${q.minute}` }
}
const toMin = (s) => { const [a, b] = s.split(':').map(Number); return a * 60 + b }

// 요금 구분은 공공데이터 '요금정보'를 따름. 단 '평일 유료시간 이외 무료'로 적힌 주차장(paidWindow)만 지금 시각으로 바꿈
const baseKind = (p) => (p.fee === '무료' ? 'free' : p.fee === '유료' ? 'paid' : p.fee === '혼합' ? 'mixed' : p.kind in COLOR ? p.kind : 'unknown')
export function feeKind(p, now = nowKST()) {
  const k = baseKind(p)
  if (!p.paidWindow || k === 'free') return k
  const paidNow = !now.weekend && now.min >= toMin(p.paidWindow.start) && now.min < toMin(p.paidWindow.end)
  return paidNow ? k : 'free'
}
export const withKind = (p, now) => ({ ...p, kind: feeKind(p, now) })

export const sortedCafes = (places) => (places || []).filter((p) => p.kind === 'cafe').sort((a, b) => a.alongKm - b.alongKm)

export const km = (m) => (m >= 1000 ? (m / 1000).toFixed(1) + 'km' : m + 'm')

// 지도 범위: 제주(추자도·마라도 포함)만
export const JEJU_BOUNDS = [[33.05, 126.05], [34.05, 127.10]]
export const JEJU_AIRPORT = { lat: 33.5104, lng: 126.4914 }
