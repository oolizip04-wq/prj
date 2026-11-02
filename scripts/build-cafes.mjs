// server/data/raw 의 CSV(전국 카페 표준 데이터)에서 제주 카페만 골라 server/data/cafes.json 으로 만든다.
// 열 이름은 자동 감지: 상호/이름, 위도, 경도, 주소, 시도, 업종.
import fs from 'node:fs'
import path from 'node:path'

const RAW = new URL('../server/data/raw/', import.meta.url)
const OUT = new URL('../server/data/cafes.json', import.meta.url)

function decode(buf) {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf)
  if (!utf8.includes('�')) return utf8.replace(/^﻿/, '')
  return new TextDecoder('euc-kr').decode(buf)   // 엑셀 한글 CSV
}

// 따옴표·쉼표·줄바꿈을 지키는 간단한 CSV 파서
function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++ } else q = false } else cur += c
    } else if (c === '"') q = true
    else if (c === ',') { row.push(cur); cur = '' }
    else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = '' }
    else cur += c
  }
  if (cur || row.length) { row.push(cur.replace(/\r$/, '')); rows.push(row) }
  return rows
}

const find = (head, ...res) => head.findIndex((h) => res.some((r) => r.test(h.trim())))
const files = fs.readdirSync(RAW).filter((f) => /\.csv$/i.test(f))
if (!files.length) { console.error('server/data/raw 에 .csv 파일이 없어요'); process.exit(1) }

const out = new Map()
let scanned = 0
for (const f of files) {
  const rows = parseCsv(decode(fs.readFileSync(new URL(f, RAW))))
  const head = rows[0]
  const iName = find(head, /^(상호명|사업장명|업소명|가게명|상호|name)$/i, /상호|사업장|업소/)
  const iLat = find(head, /^(위도|lat|latitude|y)$/i, /위도|lat/i)
  const iLng = find(head, /^(경도|lng|lon|longitude|x)$/i, /경도|lon/i)
  const iAddr = find(head, /도로명주소|소재지도로명|^주소$/, /주소|소재지/)
  const iSido = find(head, /시도명|시도/)
  const iType = find(head, /업종|분류|소분류/)
  console.log(`${f}: 이름=${head[iName]} 위도=${head[iLat]} 경도=${head[iLng]} 주소=${head[iAddr]} 시도=${head[iSido]} 업종=${head[iType]} (${rows.length - 1}행)`)
  if (iName < 0 || iLat < 0 || iLng < 0) { console.error('  → 이름/위도/경도 열을 못 찾았어요. 열 이름을 알려 주세요:', head.join(' | ')); continue }
  for (const r of rows.slice(1)) {
    scanned++
    const lat = Number(r[iLat]), lng = Number(r[iLng])
    if (!(lat > 33.0 && lat < 34.1 && lng > 126.0 && lng < 127.2)) continue   // 제주 범위만
    if (iType >= 0 && r[iType] && !/카페|커피|다방|제과|디저트|찻집|전통차|coffee|cafe/i.test(r[iType])) continue
    const name = (r[iName] || '').trim()
    if (!name) continue
    out.set(`${name}|${lat.toFixed(5)}|${lng.toFixed(5)}`, { name, lat: +lat.toFixed(6), lng: +lng.toFixed(6), addr: iAddr >= 0 ? (r[iAddr] || '').trim() : undefined })
  }
}
fs.writeFileSync(OUT, JSON.stringify([...out.values()]))
console.log(`전체 ${scanned}행 중 제주 카페 ${out.size}곳 → server/data/cafes.json (${(fs.statSync(OUT).size / 1024).toFixed(0)}KB)`)
