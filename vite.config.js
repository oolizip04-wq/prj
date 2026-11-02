import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// npm run dev 에서도 /api/* (api/ 폴더의 Vercel 형식 함수)가 동작하게 하는 개발용 미들웨어
// 배포(Vercel)에서는 이 플러그인이 쓰이지 않고 api/ 폴더가 그대로 서버 함수가 됩니다.
function devApi(env) {
  return {
    name: 'dev-api',
    configureServer(server) {
      // VITE_ 없는 서버용 키(DATA_GO_KR_KEY 등)를 서버 코드가 process.env 로 읽도록
      for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v

      server.middlewares.use('/api', async (req, res) => {
        const name = req.url.split('?')[0].replace(/^\/+/, '')
        const send = (status, body) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }
        if (!/^[\w-]+$/.test(name)) return send(404, { error: 'not found' })
        try {
          let body
          if (req.method === 'POST') {
            const chunks = []
            for await (const c of req) chunks.push(c)
            body = JSON.parse(Buffer.concat(chunks).toString() || '{}')
          }
          const mod = await server.ssrLoadModule(`/api/${name}.js`)
          const shim = {
            status(code) { res.statusCode = code; return this },
            json(obj) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(obj)) },
            setHeader: (k, v) => res.setHeader(k, v),
          }
          await mod.default({ method: req.method, body, query: {} }, shim)
        } catch (e) {
          send(e.code === 'ERR_LOAD_URL' ? 404 : 500, { error: e.message })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), devApi(env)],
    build: {
      rollupOptions: { input: { main: 'index.html', parking: 'parking.html' } },
    },
  }
})
