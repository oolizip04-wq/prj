import { findAlongRoute, getRoute } from '../server/placeTools.js'

// 길찾기: 출발·도착 좌표 → 경로선 + 경로 주변 카페(지금은 한국관광공사 TourAPI, 전국 카페 데이터가 오면 교체). AI 없이 바로 계산
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  const { fromLat, fromLng, toLat, toLng } = req.body ?? {}
  try {
    const route = await getRoute({ fromLat, fromLng, toLat, toLng })
    let places = [], placesError = null, placesSource = null
    try { const o = await findAlongRoute(route.coords, { kind: 'cafe', maxDetourM: 800, limit: 160 }); places = o.places; placesSource = o.source } catch (e) { placesError = e.message }
    res.status(200).json({ route, places, placesError, placesSource })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
