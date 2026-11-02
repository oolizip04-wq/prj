// 공공데이터포털 "전국카페표준데이터" API → 제주 카페만 골라 server/data/cafes.json 으로 저장
// 실행: npm run fetch:cafes   (키: .env.local 의 DATA_GO_KR_KEY)
import fs from 'node:fs'

const env = Object.fromEntries(fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
const key = env.DATA_GO_KR_KEY
if (!key) { console.error('.env.local 에 DATA_GO_KR_KEY 가 없어요'); process.exit(1) }

const URL_ = 'https://api.data.go.kr/openapi/tn_pubr_public_cafe_shop_api'
const ROWS = 1000
// 이 데이터는 휴게음식점 전체(편의점·김밥집 등 포함)라서, 이름에 카페 관련 단어가 있는 곳만 남김
const CAFE_WORDS = /카페|커피|coffee|cafe|café|다방|찻집|티하우스|티룸|베이커리|빵|디저트|제과|브런치|스무디|주스|아이스|젤라또|로스|브루|bakery|tea|라떼|케이크|도넛|와플|마카롱|에스프레소/i
const out = new Map()
let total = Infinity
for (let page = 1; (page - 1) * ROWS < total; page++) {
  const u = new URL(URL_)
  u.search = new URLSearchParams({ serviceKey: key, pageNo: String(page), numOfRows: String(ROWS), type: 'json' })
  const r = await fetch(u, { signal: AbortSignal.timeout(60000) })
  const j = await r.json()
  const root = j.response ?? j
  if (root.header?.resultCode !== '00') { console.error('API 오류:', JSON.stringify(root.header)); process.exit(1) }
  total = Number(root.body.totalCount)
  const items = [].concat(root.body.items?.item ?? root.body.items ?? [])
  for (const x of items) {
    if (!/제주/.test(x.ctpvNm || '') && !/제주/.test(x.lctnRoadNmAddr || x.lctnLotnoAddr || '')) continue
    const lat = Number(x.lat), lng = Number(x.lot)
    if (!(lat > 33.0 && lat < 34.1 && lng > 126.0 && lng < 127.2)) continue
    const name = (x.bplcNm || '').trim()
    if (!name || !CAFE_WORDS.test(name)) continue
    out.set(`${name}|${lat.toFixed(5)}|${lng.toFixed(5)}`, { name, lat: +lat.toFixed(6), lng: +lng.toFixed(6), addr: x.lctnRoadNmAddr || x.lctnLotnoAddr || undefined, tel: x.telno || undefined })
  }
  console.log(`페이지 ${page} 처리 (전체 ${total}곳 중 제주 ${out.size}곳)`)
}
const file = new URL('../server/data/cafes.json', import.meta.url)
fs.writeFileSync(file, JSON.stringify([...out.values()]))
console.log(`제주 카페 ${out.size}곳 → server/data/cafes.json (${(fs.statSync(file).size / 1024).toFixed(0)}KB)`)
