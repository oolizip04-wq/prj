import Anthropic from '@anthropic-ai/sdk'
import { getJejuParking } from '../server/parking.js'
import { LANDMARKS, searchParking } from '../server/parkingSearch.js'

const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-5-5'   // 보고서 권장(가장 저렴). 더 똑똑한 답이 필요하면 환경변수 CLAUDE_MODEL=claude-sonnet-5-5
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite'

import { findAlongRoute, findPlace, getRoute, getTravelTime } from '../server/placeTools.js'

// ① 도구 설명서: AI 는 이 설명만 보고 "어떤 도구를 언제 쓸지" 결정한다 (Claude·Gemini 공통)
const TOOLS = [
  {
    name: 'find_place',
    description: '장소 이름(관광지·역·시장·건물 등)을 제주 안의 좌표로 바꾼다 (OpenStreetMap Nominatim). 사용자가 특정 장소 근처 주차장을 물으면 먼저 이걸로 좌표를 구한다.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: '장소 이름 (예: "섭지코지", "제주대학교")' } }, required: ['query'] },
  },
  {
    name: 'search_parking',
    description: '제주 공영주차장 데이터(공공데이터포털 전국주차장정보표준데이터)를 조건으로 검색한다. 기준 좌표(lat,lng)나 near 를 주면 가까운 순, 안 주면 주차면수 많은 순으로 돌려준다.',
    parameters: {
      type: 'object',
      properties: {
        keyword: { type: 'string', description: '주차장 이름·주소에 들어갈 단어. 여러 단어는 공백으로 (예: "이도2동", "서귀포시 중문")' },
        lat: { type: 'number', description: '기준 위도 (find_place 결과 사용)' },
        lng: { type: 'number', description: '기준 경도' },
        near: { type: 'string', enum: Object.keys(LANDMARKS), description: '좌표 대신 쓸 수 있는 대표 장소' },
        freeOnly: { type: 'boolean', description: '지금(한국 시각 기준) 무료인 주차장만' },
        paidOnly: { type: 'boolean', description: '지금 유료인 주차장만' },
        minSpaces: { type: 'number', description: '최소 주차면수' },
        type: { type: 'string', enum: ['노상', '노외'], description: '노상=길가, 노외=별도 부지' },
        limit: { type: 'number', description: '결과 개수 (기본 10, 최대 20)' },
      },
    },
  },
  {
    name: 'get_travel_time',
    description: '두 좌표 사이 자동차 이동 시간(분)과 거리(km)를 구한다 (OSRM). 추천한 주차장까지 얼마나 걸리는지 알려줄 때 쓴다.',
    parameters: {
      type: 'object',
      properties: {
        fromLat: { type: 'number' }, fromLng: { type: 'number' },
        toLat: { type: 'number' }, toLng: { type: 'number' },
      },
      required: ['fromLat', 'fromLng', 'toLat', 'toLng'],
    },
  },
  {
    name: 'get_route',
    description: '출발지에서 목적지까지 자동차 경로를 구해 지도에 그린다 (OSRM). 출발 좌표를 생략하면 사용자 현재 위치를 쓴다. "가는 길에 카페/맛집"을 물으면 find_along_route 전에 이걸 먼저 부른다.',
    parameters: {
      type: 'object',
      properties: {
        toLat: { type: 'number', description: '도착지 위도 (주차장·장소 좌표)' }, toLng: { type: 'number', description: '도착지 경도' },
        fromLat: { type: 'number', description: '출발 위도 (생략 시 사용자 위치)' }, fromLng: { type: 'number', description: '출발 경도' },
      },
      required: ['toLat', 'toLng'],
    },
  },
  {
    name: 'find_along_route',
    description: '가장 최근 get_route 경로 양옆에 있는 카페·음식점을 찾는다 (소상공인 상가정보 등 공공데이터). 결과는 출발지에서 가까운 순이며 alongKm 은 출발지부터 경로를 따라 간 거리(km)다. 별점·영업시간은 모른다.',
    parameters: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['all', 'cafe', 'restaurant'], description: '전체 / 카페 / 음식점 (기본 all)' },
        maxDetourM: { type: 'number', description: '경로에서 벗어나도 되는 최대 거리(m), 기본 500' },
        limit: { type: 'number', description: '결과 개수, 기본 8' },
      },
    },
  },
]

const SYSTEM = `너는 제주 주차장 안내 에이전트다.
- 특정 장소 근처를 물으면 find_place 로 좌표를 구하고, 그 좌표로 search_parking 을 부른다. 이동 시간이 궁금하면 get_travel_time 을 쓴다.
- "가는 길에 카페/맛집"을 물으면: 목적지(주차장 등) 좌표를 정하고 → get_route → find_along_route 순서로 부른다. 출발지를 말하지 않았고 사용자 위치가 있으면 그 위치가 출발지다. 없으면 어디서 출발하는지 되묻는다.
- 카페·맛집 데이터는 공공데이터라 별점·후기·영업 여부를 모른다. "영업 중"이라고 단정하지 말고 이름·종류·"출발지에서 ○km 지점"(alongKm)·"경로에서 ○m"(detourM)만 말한다.
- 주차장 정보는 반드시 search_parking 도구로 확인한 뒤 답한다. 도구 결과에 없는 주차장은 지어내지 않는다.
- 현재 데이터는 제주 "공영주차장"뿐이다. 사설(민영) 주차장 정보는 없으니, 물으면 없다고 솔직히 말한다.
- 실시간 빈자리 정보는 없다. 면수는 "총 주차면수"다.
- 요금은 데이터의 요금정보(무료/유료/혼합)를 따른다. 요일별 요금 정보는 "평일 유료시간 이외 무료"라고 적힌 일부 주차장에만 있다. 그 밖의 주차장에 대해 "주말은 무료"라고 추측해서 말하지 않는다.
- freeOnly/paidOnly 는 "지금" 기준이다. 결과의 now 는 현재 한국 요일·시각이다.
- 장소 기준이 없는데 "근처"라고 하면, 사용자 위치(있을 때)나 가장 가까운 대표 장소를 쓰거나 어디 기준인지 되묻는다.
- 답은 한국어로, 5문장 이내. 추천하는 주차장은 이름·요금·면수·거리를 짧게 적는다.`

// 도구 실행 → 모델에게 줄 결과. 주차장 검색 결과는 화면 지도용으로 state.found 에도 저장
async function runTool(name, args, ctx) {
  args = args ?? {}
  if (name === 'find_place') return await findPlace(String(args.query ?? ''))
  if (name === 'get_travel_time') return await getTravelTime(args)
  if (name === 'get_route') {
    const u = ctx.userLoc
    const from = { fromLat: args.fromLat ?? u?.lat, fromLng: args.fromLng ?? u?.lng }
    const r = await getRoute({ ...from, toLat: args.toLat, toLng: args.toLng })
    ctx.state.route = { coords: r.coords, from: [from.fromLat, from.fromLng], to: [args.toLat, args.toLng], minutes: r.minutes, km: r.km }
    ctx.state.places = []
    return { minutes: r.minutes, km: r.km, note: '경로를 지도에 표시했어요' }
  }
  if (name === 'find_along_route') {
    const o = await findAlongRoute(ctx.state.route?.coords, args)
    ctx.state.places = o.places
    return o
  }
  if (name === 'search_parking') {
    const out = searchParking(ctx.items, args, ctx.userLoc)
    ctx.state.found = out.results
    const slim = out.results.map((p) => ({
      id: p.id, name: p.name, type: p.type, addr: p.addr, lat: p.lat, lng: p.lng, spaces: p.spaces, fee: p.fee, freeNow: p.freeNow, note: p.note || undefined,
      basicTime: p.basicTime, basicCharge: p.basicCharge, hours: `${p.weekdayOpen}~${p.weekdayClose}`, distanceM: p.distanceM,
    }))
    return { now: out.now, total: out.total, results: slim }
  }
  return { error: '없는 도구: ' + name }
}
// 실패해도 에이전트가 멈추지 않게: 오류를 결과로 돌려주면 AI 가 다른 방법을 고른다
async function callTool(name, args, ctx) {
  let out
  try { out = await runTool(name, args, ctx) } catch (e) { out = { error: e.message } }
  const count = out.total ?? out.found ?? (out.minutes != null ? 1 : out.error ? 0 : 1)
  ctx.steps.push({ tool: name, args, count, error: out.error, summary: summarize(name, out) })
  return out
}
const summarize = (name, o) => o.error ? '실패: ' + o.error
  : name === 'find_place' ? (o.places?.[0] ? `${o.places[0].name} (${o.places[0].lat.toFixed(4)}, ${o.places[0].lng.toFixed(4)})` : '장소를 못 찾음')
  : name === 'get_route' ? `경로 ${o.minutes}분 · ${o.km}km`
  : name === 'find_along_route' ? `경로 주변 ${o.found}곳`
  : name === 'get_travel_time' ? `차로 약 ${o.minutes}분 · ${o.km}km`
  : `${o.total}곳 중 ${o.results.length}곳`

// ② 에이전트 루프(Claude): 생각 → 도구 호출 → 결과 확인 → (반복) → 최종 답
async function runClaude(messages, ctx) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const tools = TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }))
  for (let turn = 0; turn < 5; turn++) {
    const r = await client.messages.create({ model: CLAUDE_MODEL, max_tokens: 1024, system: SYSTEM, tools, messages })
    if (r.stop_reason !== 'tool_use') return r.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n')
    messages.push({ role: 'assistant', content: r.content })
    const results = []
    for (const block of r.content) {
      if (block.type !== 'tool_use') continue
      const o = await callTool(block.name, block.input, ctx)
      results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(o) })
    }
    messages.push({ role: 'user', content: results })
  }
  return null
}

// ②' 에이전트 루프(Gemini): 같은 흐름, 메시지 형식만 다름 (functionCall / functionResponse)
async function runGemini(messages, ctx) {
  const contents = messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
  for (let turn = 0; turn < 5; turn++) {
    let r, j
    for (let attempt = 0; attempt < 4; attempt++) {   // 503(과부하)·429 는 잠깐 쉬고 재시도
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          tools: [{ functionDeclarations: TOOLS }],
          contents,
        }),
      })
      j = await r.json()
      if (r.status !== 503 && r.status !== 429) break
      await new Promise((ok) => setTimeout(ok, 1500 * (attempt + 1)))
    }
    if (!r.ok) {
      const err = new Error(j.error?.message || r.statusText)
      err.status = r.status
      throw err
    }
    const parts = j.candidates?.[0]?.content?.parts ?? []
    const calls = parts.filter((p) => p.functionCall)
    if (!calls.length) return parts.filter((p) => p.text).map((p) => p.text).join('\n')
    contents.push({ role: 'model', parts })   // 원본 parts 를 그대로 기록해야 함 (생각 서명 포함)
    const responses = []
    for (const { functionCall: c } of calls) responses.push({ functionResponse: { name: c.name, response: await callTool(c.name, c.args, ctx) } })
    contents.push({ role: 'user', parts: responses })
  }
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const useClaude = Boolean(process.env.ANTHROPIC_API_KEY)
  const useGemini = Boolean(process.env.GEMINI_API_KEY)
  if (!useClaude && !useGemini) return res.status(500).json({ error: 'ANTHROPIC_API_KEY 또는 GEMINI_API_KEY 가 .env.local 에 필요해요' })
  if (!process.env.DATA_GO_KR_KEY) return res.status(500).json({ error: 'DATA_GO_KR_KEY 가 .env.local 에 없어요' })

  const { message, history = [], userLoc = null } = req.body ?? {}
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'message 가 필요해요' })

  const locNote = userLoc ? `\n(사용자 현재 위치: 위도 ${userLoc.lat}, 경도 ${userLoc.lng} — "내 근처"는 이 위치 기준)` : ''
  const messages = [...history.slice(-10), { role: 'user', content: message + locNote }]
  const steps = []
  const state = { found: [], route: null, places: [] }   // 마지막 검색 결과 → 화면 지도에 강조 표시

  try {
    const items = await getJejuParking(process.env.DATA_GO_KR_KEY)
    const base = messages.map((m) => ({ ...m }))   // Claude 가 도중에 messages 를 바꾸므로 Gemini 용 원본을 따로 보관
    let answer, model, fallback
    if (useClaude) {
      try {
        answer = await runClaude(messages, { items, userLoc, steps, state })
        model = 'claude'
      } catch (e) {
        // 크레딧 부족·키 오류·사용량 초과·서버 오류면 Gemini 가 있을 때 자동으로 넘어감 (AI 검색이 통째로 멈추지 않게)
        if (!useGemini) throw e
        console.warn('[claude 실패 → gemini 로 대체]', String(e.message).slice(0, 160))
        fallback = /credit|billing/i.test(e.message) ? 'Claude 크레딧이 부족해서 Gemini로 답했어요' : 'Claude 호출이 실패해서 Gemini로 답했어요'
        steps.length = 0; state.found = []; state.route = null; state.places = []
      }
    }
    if (answer === undefined) {
      answer = (await runGemini(base, { items, userLoc, steps, state })) ?? null
      model = 'gemini'
    }
    answer = answer ?? '도구 호출이 너무 많아 중단했어요. 질문을 좁혀 주세요.'
    res.status(200).json({ answer, steps, results: state.found, route: state.route, places: state.places, model, fallback })
  } catch (e) {
    res.status(e.status ?? 500).json({ error: e.status === 429 ? '사용량이 많아요. 1분 뒤 다시 시도하세요.' : e.message })
  }
}
