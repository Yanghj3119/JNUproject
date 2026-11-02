import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// npm run dev 만으로 /api/* 서버 함수가 동작하도록 하는 개발용 미들웨어
// (배포 시에는 Vercel 이 api/ 폴더를 서버 함수로 실행합니다)
function apiDev(env) {
  return {
    name: 'api-dev',
    configureServer(server) {
      for (const [k, v] of Object.entries(env)) if (process.env[k] === undefined) process.env[k] = v

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        const url = new URL(req.url, 'http://localhost')
        const name = url.pathname.slice(5).replace(/[^a-z0-9-]/gi, '')

        res.status = (code) => { res.statusCode = code; return res }
        res.json = (obj) => {
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify(obj))
        }

        let mod
        try { mod = await server.ssrLoadModule(`/api/${name}.js`) }
        catch { return res.status(404).json({ error: `/api/${name} 없음` }) }

        req.query = Object.fromEntries(url.searchParams)
        if (req.method === 'POST') {
          const chunks = []
          for await (const c of req) chunks.push(c)
          try { req.body = JSON.parse(Buffer.concat(chunks).toString() || '{}') } catch { req.body = {} }
        }
        try { await mod.default(req, res) }
        catch (e) { res.status(500).json({ error: e.message }) }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), apiDev(loadEnv(mode, process.cwd(), ''))],
  build: { chunkSizeWarningLimit: 1500 },
}))
