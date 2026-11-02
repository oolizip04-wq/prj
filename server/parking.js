// 전국주차장정보표준데이터 → 제주만 골라 공영/사설로 정리 (api/parking.js 와 vite dev 서버가 함께 사용)
// 지역 필터 파라미터가 없어서 전국(약 1.9만 건)을 받아 주소로 제주만 거릅니다 (호출 1000건당 약 0.25초)
const ENDPOINT = 'https://api.data.go.kr/openapi/tn_pubr_prkplce_info_api'
const PAGE = 1000
const MAX_PAGES = 30

const pick = (o, names) => {
  for (const n of names) if (o[n] !== undefined && o[n] !== '') return o[n]
  return ''
}

// 요금 구분: 공공데이터의 '요금정보'(무료/유료/혼합)를 그대로 따름
const feeKindOf = (fee) => (fee === '무료' ? 'free' : fee === '유료' ? 'paid' : fee === '혼합' ? 'mixed' : 'unknown')

// 특기사항에 "유료운영시간(평일 09:00 ~ 18:00) 이외는 무료" 라고 적힌 곳만 요일·시간으로 유무료를 바꿈
// (그 외 주차장은 요일별 요금 정보가 데이터에 없음)
function parsePaidWindow(note) {
  const m = /유료운영시간\(평일\s*(\d{1,2}:\d{2})\s*~\s*(\d{1,2}:\d{2})\)\s*이외는\s*무료/.exec(note || '')
  return m ? { days: 'weekday', start: m[1], end: m[2] } : null
}

function normalize(r) {
  const kind = String(pick(r, ['prkplceSe', 'prkplceSeNm']))   // 공영 / 민영
  const fee = pick(r, ['parkingchrgeInfo'])
  const note = pick(r, ['spcmnt'])
  return {
    id: pick(r, ['prkplceNo']),
    name: pick(r, ['prkplceNm']),
    kind: feeKindOf(fee),   // free | paid | mixed | unknown (화면 필터·핀 색 기준)
    owner: kind.includes('공영') ? 'public' : kind.includes('민영') ? 'private' : 'unknown',
    kindRaw: kind,
    type: pick(r, ['prkplceType']),                            // 노상 / 노외 / 부설
    addr: pick(r, ['rdnmadr', 'lnmadr']),
    lat: Number(pick(r, ['latitude'])),
    lng: Number(pick(r, ['longitude'])),
    spaces: Number(pick(r, ['prkcmprt'])) || 0,
    fee,
    note,
    paidWindow: parsePaidWindow(note),
    basicTime: pick(r, ['basicTime']),
    basicCharge: pick(r, ['basicCharge']),
    weekdayOpen: pick(r, ['weekdayOperOpenHhmm']),
    weekdayClose: pick(r, ['weekdayOperColseHhmm', 'weekdayOperCloseHhmm']),
    phone: pick(r, ['phoneNumber']),
  }
}

// 1시간 메모리 캐시 (호출 1회에 약 4초 걸려서, 에이전트가 여러 번 검색해도 한 번만 받음)
let cache = { at: 0, items: null }
export async function getJejuParking(serviceKey) {
  if (cache.items && Date.now() - cache.at < 3600_000) return cache.items
  cache = { at: Date.now(), items: await fetchJejuParking(serviceKey) }
  return cache.items
}

export async function fetchJejuParking(serviceKey) {
  const all = []
  let total = Infinity
  for (let page = 1; page <= MAX_PAGES && all.length < total; page++) {
    const url = new URL(ENDPOINT)
    url.searchParams.set('serviceKey', serviceKey)
    url.searchParams.set('pageNo', page)
    url.searchParams.set('numOfRows', PAGE)
    url.searchParams.set('type', 'json')
    const res = await fetch(url)
    const text = await res.text()
    let json
    try { json = JSON.parse(text) } catch { throw new Error(`JSON 아님: ${text.slice(0, 200)}`) }
    const root = json.response ?? json   // 실제 응답은 {header, body} 로 바로 옴
    const body = root.body
    if (!body) throw new Error(root.header?.resultMsg || '응답 형식을 알 수 없음')
    const items = Array.isArray(body.items) ? body.items : body.items?.item ?? []
    total = Number(body.totalCount) || 0
    all.push(...items)
    if (!items.length) break
  }
  return all
    .map(normalize)
    .filter((p) => /제주/.test(p.addr) && p.lat > 33 && p.lat < 34 && p.lng > 126 && p.lng < 127)
}
