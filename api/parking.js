import { getJejuParking } from '../server/parking.js'

// GET /api/parking → { items: [...] }  (키는 서버에서만 사용)
export default async function handler(req, res) {
  const key = process.env.DATA_GO_KR_KEY
  if (!key) return res.status(500).json({ error: 'DATA_GO_KR_KEY 가 설정되지 않았어요' })
  try {
    const items = await getJejuParking(key)
    res.setHeader('Cache-Control', 's-maxage=3600')
    res.status(200).json({ items })
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
}
