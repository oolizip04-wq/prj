// 소상공인 상가(상권)정보 API 로 제주 전역의 카페(업종 소분류 I21201)를 한 번에 모아 server/data/cafes_sbiz.json 으로 저장
// 실행: npm run fetch:cafes:sbiz   (키: .env.local 의 DATA_GO_KR_KEY, 약 2~3분 걸림. 한 달에 한 번쯤 갱신하면 충분)
import fs from 'node:fs'

const env = Object.fromEntries(fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
const key = env.SBIZ_KEY || env.DATA_GO_KR_KEY
const BASE = 'https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius'
const RADIUS = 2000, STEP_KM = 2.7   // 반경 2km 원을 2.7km 간격으로 깔면 빈틈 없이 덮임
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let last = 0
async function get(u) {   // 초당 4건 이하로
  for (let a = 0; a < 5; a++) {
    const wait = Math.max(0, last + 260 - Date.now()); last = Date.now() + wait; await sleep(wait)
    const r = await fetch(u, { signal: AbortSignal.timeout(30000) })
    if (r.status === 429 || r.status >= 500) { await sleep(1500 * (a + 1)); continue }
    if (r.status === 401 || r.status === 403) throw new Error('상가정보 활용신청이 안 된 키예요')
    return r.json()
  }
  throw new Error('요청 한도 초과가 계속돼요')
}

const out = new Map()
let stdrYm = ''
let calls = 0, cells = 0
const dLat = STEP_KM / 111, dLng = STEP_KM / 92.9
for (let lat = 33.10; lat <= 33.62; lat += dLat) {
  for (let lng = 126.10; lng <= 127.02; lng += dLng) {
    if (((lng - 126.55) / 0.46) ** 2 + ((lat - 33.38) / 0.25) ** 2 > 1) continue   // 제주섬 둘레 밖(바다)은 건너뜀
    cells++
    for (let page = 1; page <= 5; page++) {
      const u = new URL(BASE)
      u.search = new URLSearchParams({ serviceKey: key, type: 'json', radius: String(RADIUS), cx: lng.toFixed(5), cy: lat.toFixed(5), indsSclsCd: 'I21201', numOfRows: '1000', pageNo: String(page) })
      const j = await get(u); calls++
      const h = j.header ?? j.response?.header
      if (h?.resultCode === '03' || /NODATA/.test(h?.resultMsg || '')) break
      if (h?.resultCode && h.resultCode !== '00') throw new Error('API 오류: ' + JSON.stringify(h))
      stdrYm = h?.stdrYm || stdrYm
      const b = j.body ?? j.response?.body
      const items = Array.isArray(b?.items) ? b.items : [].concat(b?.items?.item ?? [])
      for (const x of items) {
        const la = Number(x.lat), lo = Number(x.lon)
        if (!x.bizesNm || !Number.isFinite(la) || !Number.isFinite(lo)) continue
        if (!(la > 33.0 && la < 34.1 && lo > 126.0 && lo < 127.2)) continue
        out.set(x.bizesId || `${x.bizesNm}|${la}|${lo}`, { name: x.brchNm ? `${x.bizesNm} ${x.brchNm}` : x.bizesNm, lat: +la.toFixed(6), lng: +lo.toFixed(6), addr: x.rdnmAdr || x.lnoAdr || undefined })
      }
      if (page * 1000 >= Number(b?.totalCount ?? 0)) break
    }
    if (cells % 25 === 0) console.log(`격자 ${cells}칸 · 호출 ${calls}회 · 카페 ${out.size}곳`)
  }
}
const file = new URL('../server/data/cafes_sbiz.json', import.meta.url)
fs.writeFileSync(file, JSON.stringify({ stdrYm, savedAt: new Date().toISOString().slice(0, 10), cafes: [...out.values()] }))
console.log(`완료: 제주 카페 ${out.size}곳 (기준 ${stdrYm}) → server/data/cafes_sbiz.json (${(fs.statSync(file).size / 1024).toFixed(0)}KB)`)
