// 에이전트가 쓰는 외부 API 도구 2개 (둘 다 API 키 불필요)
//  - find_place      : Nominatim(OpenStreetMap) 지오코딩 — 장소 이름 → 좌표
//  - get_travel_time : OSRM 공개 서버 — 두 좌표 사이 자동차 이동 시간·거리

const UA = { 'User-Agent': 'jeju-parking-agent/1.0 (study project)' }
const inJeju = (lat, lng) => lat > 33.05 && lat < 34.05 && lng > 126.05 && lng < 127.1

export async function findPlace(query) {
  const u = new URL('https://nominatim.openstreetmap.org/search')
  u.search = new URLSearchParams({
    q: query, format: 'jsonv2', limit: '3', 'accept-language': 'ko',
    viewbox: '126.05,34.05,127.10,33.05', bounded: '1',   // 제주 안에서만
  })
  const r = await fetch(u, { headers: UA })
  if (!r.ok) throw new Error(`Nominatim ${r.status}`)
  const rows = (await r.json()).map((x) => ({ name: x.name || x.display_name.split(',')[0], addr: x.display_name, lat: Number(x.lat), lng: Number(x.lon) }))
    .filter((x) => inJeju(x.lat, x.lng))
  return { found: rows.length, places: rows }
}

export async function getTravelTime({ fromLat, fromLng, toLat, toLng }) {
  const nums = [fromLat, fromLng, toLat, toLng].map(Number)
  if (nums.some((n) => !Number.isFinite(n))) throw new Error('좌표 4개(fromLat, fromLng, toLat, toLng)가 필요해요')
  const [a, b, c, d] = nums
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${b},${a};${d},${c}?overview=false`, { headers: UA })
  if (!r.ok) throw new Error(`OSRM ${r.status}`)
  const route = (await r.json()).routes?.[0]
  if (!route) return { error: '경로를 찾지 못했어요' }
  return { minutes: Math.max(1, Math.round(route.duration / 60)), km: Math.round(route.distance / 100) / 10 }
}

// ── 경로 · 경로 주변 장소 ──
const rad = (d) => (d * Math.PI) / 180
// 점(p)에서 선분(a-b)까지 거리(m). 제주 정도의 좁은 범위라 평면 근사로 충분
function distToSeg(p, a, b) {
  const k = Math.cos(rad(p[0])) * 111320, h = 110540
  const px = (p[1] - a[1]) * k, py = (p[0] - a[0]) * h
  const bx = (b[1] - a[1]) * k, by = (b[0] - a[0]) * h
  const len2 = bx * bx + by * by
  const t = len2 ? Math.max(0, Math.min(1, (px * bx + py * by) / len2)) : 0
  return { d: Math.hypot(px - t * bx, py - t * by), t }
}

// 현재 위치(또는 출발 좌표)에서 목적지까지의 자동차 경로. 좌표 목록(coords)은 지도용으로 따로 돌려줌
export async function getRoute({ fromLat, fromLng, toLat, toLng }) {
  const nums = [fromLat, fromLng, toLat, toLng].map(Number)
  if (nums.some((n) => !Number.isFinite(n))) throw new Error('출발·도착 좌표가 필요해요 (출발은 사용자 위치가 있으면 생략 가능)')
  const [a, b, c, d] = nums
  const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${b},${a};${d},${c}?overview=full&geometries=geojson`, { headers: UA })
  if (!r.ok) throw new Error(`OSRM ${r.status}`)
  const route = (await r.json()).routes?.[0]
  if (!route) throw new Error('경로를 찾지 못했어요')
  const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng])
  return { minutes: Math.max(1, Math.round(route.duration / 60)), km: Math.round(route.distance / 100) / 10, coords }
}

// 한국관광공사 TourAPI(공공데이터포털 KorService2): 좌표 반경 안의 음식점(39). cat3 A05020900 = 카페/전통찻집
const TOUR = 'https://apis.data.go.kr/B551011/KorService2/locationBasedList2'
const CAFE_CAT3 = 'A05020900'
const hav = (a, b) => {
  const x = Math.sin(rad(b[0] - a[0]) / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(rad(b[1] - a[1]) / 2) ** 2
  return 6371000 * 2 * Math.asin(Math.sqrt(x))
}

async function tourNear(key, [lat, lng], radius) {
  const u = new URL(TOUR)
  u.search = new URLSearchParams({ serviceKey: key, MobileOS: 'ETC', MobileApp: 'jeju-parking', _type: 'json', mapX: String(lng), mapY: String(lat), radius: String(radius), contentTypeId: '39', numOfRows: '100', arrange: 'E' })
  let r
  for (let attempt = 0; attempt < 2; attempt++) {   // 가끔 느린 응답은 한 번 더 시도
    try { r = await fetch(u, { signal: AbortSignal.timeout(6000) }); break } catch (e) { if (attempt) throw e }
  }
  if (!r.ok) throw new Error(`TourAPI ${r.status}`)
  const j = await r.json()
  const head = j.response?.header
  if (head && head.resultCode !== '0000') throw new Error(`TourAPI ${head.resultMsg}`)
  const item = j.response?.body?.items?.item
  return Array.isArray(item) ? item : item ? [item] : []
}

import { readFileSync } from 'node:fs'
// 상가정보 API 로 제주 전역을 한 번 훑어 저장해 둔 카페 목록 (server/data/cafes_sbiz.json). 있으면 API 를 부르지 않고 바로 검색 → 거의 즉시
let SNAPSHOT
function sbizSnapshot() {
  if (SNAPSHOT === undefined) {
    try { SNAPSHOT = JSON.parse(readFileSync(new URL('./data/cafes_sbiz.json', import.meta.url), 'utf8')) } catch { SNAPSHOT = null }
  }
  return SNAPSHOT
}
// 전국 카페 표준 데이터에서 만든 제주 카페 목록 (server/data/cafes.json). 파일이 없으면 null → TourAPI 로 대체
let LOCAL_CAFES
function localCafes() {
  if (LOCAL_CAFES === undefined) {
    try { LOCAL_CAFES = JSON.parse(readFileSync(new URL('./data/cafes.json', import.meta.url), 'utf8')) } catch { LOCAL_CAFES = null }
  }
  return LOCAL_CAFES
}

// 후보 가게(name, lat, lng, addr)를 경로에서 가까운 것만 골라, 출발지부터 경로를 따라 간 거리(alongKm) 순으로 정렬
function rankAlong(coords, cands, maxDetourM, limit, source, perBucket = 5) {
  const pts = coords.filter((_, i) => i % Math.max(1, Math.ceil(coords.length / 200)) === 0 || i === coords.length - 1)
  const tot = pts.length - 1
  const cum = [0]; for (let i = 0; i < tot; i++) cum.push(cum[i] + hav(pts[i], pts[i + 1]))
  const padDeg = (maxDetourM + 200) / 100000
  const la = pts.map((p) => p[0]), ln = pts.map((p) => p[1])
  const [minLa, maxLa, minLn, maxLn] = [Math.min(...la) - padDeg, Math.max(...la) + padDeg, Math.min(...ln) - padDeg, Math.max(...ln) + padDeg]
  const hits = []
  for (const cf of cands) {
    if (!(cf.lat >= minLa && cf.lat <= maxLa && cf.lng >= minLn && cf.lng <= maxLn)) continue
    let best = { d: Infinity, t: 0, i: 0 }
    for (let i = 0; i < tot; i++) { const sg = distToSeg([cf.lat, cf.lng], pts[i], pts[i + 1]); if (sg.d < best.d) best = { ...sg, i } }
    if (best.d <= maxDetourM) hits.push({ name: cf.name, kind: 'cafe', lat: cf.lat, lng: cf.lng, addr: cf.addr, detourM: Math.round(best.d), alongKm: Math.round((cum[best.i] + best.t * (cum[best.i + 1] - cum[best.i])) / 100) / 10 })
  }
  // 한 구간(2km)에 몰리지 않게: 구간마다 길과 가까운 순으로 perBucket 곳만 남김
  const buckets = new Map()
  for (const h of hits) { const k = Math.floor(h.alongKm / 2); (buckets.get(k) || buckets.set(k, []).get(k)).push(h) }
  const picked = []
  for (const arr of buckets.values()) picked.push(...arr.sort((x, y) => x.detourM - y.detourM).slice(0, perBucket))
  picked.sort((x, y) => x.alongKm - y.alongKm)
  // 개수 제한이 있으면 앞에서부터 자르지 않고 경로 전체에서 고르게 뽑음 (안 그러면 출발지 쪽만 나옴)
  const lim = Math.min(Number(limit) || 10, 300)
  const out = picked.length > lim ? Array.from({ length: lim }, (_, i) => picked[Math.round((i * (picked.length - 1)) / Math.max(1, lim - 1))]) : picked
  return { found: hits.length, shown: out.length, places: out, source }
}

// 소상공인시장진흥공단 상가(상권)정보 — 좌표 반경 안의 카페(업종 소분류 I21201). 같은 data.go.kr 키로 활용신청하면 바로 사용
const SBIZ = 'https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius'
let sbizDownUntil = 0
// 상가정보 API 는 초당 요청 수 제한이 있어서(약 4~5건), 요청 시작을 0.25초 간격으로 줄 세우고 거부되면 잠시 뒤 재시도
let sbizSlot = 0
const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms))
async function sbizGet(u) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const now = Date.now()
    sbizSlot = Math.max(sbizSlot, now) + 250
    await sleep(sbizSlot - 250 - now)
    const r = await fetch(u, { signal: AbortSignal.timeout(15000) })
    if (r.status !== 429 && r.status < 500) return r
    await sleep(1000 * (attempt + 1))
  }
  throw new Error('상가정보 요청 한도 초과')
}
const SBIZ_CACHE = new Map()
async function sbizNear(key, [lat, lng], radius) {
  const ck = `${lat.toFixed(3)},${lng.toFixed(3)},${radius}`
  const hit = SBIZ_CACHE.get(ck)
  if (hit && Date.now() - hit.at < 3600_000) return hit.rows
  const rows = await sbizFetch(key, [lat, lng], radius)
  SBIZ_CACHE.set(ck, { at: Date.now(), rows })
  return rows
}
async function sbizFetch(key, [lat, lng], radius) {
  const rows = []
  for (let page = 1; page <= 4; page++) {
    const u = new URL(SBIZ)
    u.search = new URLSearchParams({ serviceKey: key, radius: String(radius), cx: String(lng), cy: String(lat), indsSclsCd: 'I21201', type: 'json', numOfRows: '500', pageNo: String(page) })
    const r = await sbizGet(u)
    if (r.status === 401 || r.status === 403) { const e = new Error('소상공인 상가정보 활용신청 전'); e.code = 'NOT_REGISTERED'; throw e }
    if (!r.ok) throw new Error('상가정보 ' + r.status)
    const j = await r.json()
    const head = j.header ?? j.response?.header
    if (head?.resultCode === '03' || /NODATA/.test(head?.resultMsg || '')) break   // 그 반경에 상가가 없음(바다·산) → 빈 결과
    if (head?.resultCode && head.resultCode !== '00') throw new Error('상가정보 ' + (head.resultMsg || head.resultCode))
    const body = j.body ?? j.response?.body
    let items = body?.items ?? []
    if (!Array.isArray(items)) items = items.item ? [].concat(items.item) : []
    for (const x of items) {
      const la = Number(x.lat), lo = Number(x.lon)
      if (x.bizesNm && Number.isFinite(la) && Number.isFinite(lo)) rows.push({ name: x.bizesNm, lat: la, lng: lo, addr: x.rdnmAdr || x.lnoAdr })
    }
    if (page * 500 >= Number(body?.totalCount ?? 0)) break
  }
  return rows
}
async function sbizAlong(coords, key, maxDetourM) {
  const radius = 1300
  const samples = []   // 경로를 따라 2km 간격 (반경 1.3km → 길에서 800m 안이 모두 덮임)
  let acc = Infinity
  for (let i = 0; i < coords.length; i++) {
    if (i) acc += hav(coords[i - 1], coords[i])
    if (acc >= 2000 || i === coords.length - 1) { samples.push(coords[i]); acc = 0 }
  }
  const seen = new Map()
  let failed = 0
  {
    const batch = await Promise.all(samples.map((p) => sbizNear(key, p, radius).catch((e) => { if (e.code === 'NOT_REGISTERED') throw e; failed++; return [] })))
    batch.flat().forEach((c) => seen.set(`${c.name}|${c.lat.toFixed(5)}|${c.lng.toFixed(5)}`, c))
  }
  if (failed > samples.length / 2) throw new Error(`상가정보 호출 ${failed}/${samples.length} 실패`)   // 절반 넘게 실패하면 다른 자료로 대체
  return [...seen.values()]
}

// 경로(coords) 양옆 maxDetourM 안의 카페·음식점. kind: cafe | restaurant | all. 출발지부터 경로를 따라 간 거리(alongKm)로 돌려줌
export async function findAlongRoute(coords, { kind = 'all', maxDetourM = 500, limit = 10, noLocal = false } = {}, key = process.env.DATA_GO_KR_KEY) {
  if (!coords?.length) throw new Error('먼저 get_route 로 경로를 구해야 해요')
  if (!key) throw new Error('DATA_GO_KR_KEY 가 없어요')
  if (kind !== 'restaurant' && !noLocal) {
    // ⓪ 미리 저장해 둔 제주 전역 카페(상가정보) — 가장 빠름
    const snap = sbizSnapshot()
    if (snap?.cafes?.length) return rankAlong(coords, snap.cafes, maxDetourM, limit, 'sbiz-saved')
    // ① 소상공인 상가정보 API(제주시·서귀포시 모두, 최신) → ② 내려받아 둔 전국카페표준데이터(서귀포시)+관광공사 → ③ 관광공사
    if (Date.now() > sbizDownUntil) {
      try {
        const cands = await sbizAlong(coords, process.env.SBIZ_KEY || key, maxDetourM)
        return rankAlong(coords, cands, maxDetourM, limit, 'sbiz')
      } catch (e) {
        if (e.code === 'NOT_REGISTERED') sbizDownUntil = Date.now() + 10 * 60 * 1000   // 활용신청 전이면 10분간 건너뜀
        else console.warn('[sbiz]', e.message)
      }
    }
    const local = localCafes()
    if (local && local.length) {
      // 전국카페표준데이터에는 서귀포시만 있어서, 제주시 쪽은 관광공사 카페로 보강(가까운 같은 이름은 중복 제거)
      const a2 = rankAlong(coords, local, maxDetourM, 200, 'local')
      const t = await findAlongRoute(coords, { kind: 'cafe', maxDetourM, limit: 200, noLocal: true }, key).catch(() => ({ places: [] }))
      const extra = t.places.filter((p) => !a2.places.some((q) => hav([p.lat, p.lng], [q.lat, q.lng]) < 80 && (q.name.includes(p.name) || p.name.includes(q.name) || hav([p.lat, p.lng], [q.lat, q.lng]) < 20)))
      const all = [...a2.places, ...extra].sort((x, y) => x.alongKm - y.alongKm)
      return { found: all.length, places: all.slice(0, Math.min(Number(limit) || 10, 200)), source: extra.length ? 'local+tour' : 'local' }
    }
  }
  const step = Math.max(1, Math.ceil(coords.length / 120))
  const pts = coords.filter((_, i) => i % step === 0 || i === coords.length - 1)
  const total = pts.length - 1
  const cum = [0]   // 출발점부터 각 점까지 경로를 따라 간 누적 거리(m)
  for (let i = 0; i < total; i++) cum.push(cum[i] + hav(pts[i], pts[i + 1]))
  // 경로를 따라 약 2.5km 간격으로 반경 1.5km 를 조회 (겹치게) → 중복 제거 → 경로와의 거리로 거름
  const samples = []
  let next = 0
  pts.forEach((p, i) => { if (cum[i] >= next || i === total) { samples.push(p); next = cum[i] + 2500 } })
  const found = new Map()
  for (let i = 0; i < samples.length; i += 6) {
    const batch = await Promise.all(samples.slice(i, i + 6).map((p) => tourNear(key, p, 1500)))
    batch.flat().forEach((it) => found.set(it.contentid, it))
  }
  const places = [...found.values()].map((it) => {
    const lat = Number(it.mapy), lng = Number(it.mapx)
    let best = { d: Infinity, t: 0, i: 0 }
    for (let i = 0; i < total; i++) { const s = distToSeg([lat, lng], pts[i], pts[i + 1]); if (s.d < best.d) best = { ...s, i } }
    const k = it.cat3 === CAFE_CAT3 ? 'cafe' : 'restaurant'
    return {
      name: it.title, kind: k, lat, lng, addr: it.addr1,
      detourM: Math.round(best.d), alongKm: Math.round((cum[best.i] + best.t * (cum[best.i + 1] - cum[best.i])) / 100) / 10,
      tel: it.tel || undefined,
    }
  }).filter((p) => p.detourM <= maxDetourM && (kind === 'all' || p.kind === kind)).sort((x, y) => x.alongKm - y.alongKm)
  return { found: places.length, places: places.slice(0, Math.min(Number(limit) || 10, 40)), source: 'tour' }
}
