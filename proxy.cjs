const http = require('http')

const WSL_HOST = '172.30.239.252'
const WSL_PORT = 8002
const LOCAL_PORT = 9002

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const chunks = []
  req.on('data', (c) => chunks.push(c))
  req.on('end', () => {
    const proxyReq = http.request(
      { hostname: WSL_HOST, port: WSL_PORT, path: req.url, method: req.method, headers: { 'Content-Type': 'application/json' } },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers)
        proxyRes.pipe(res)
      }
    )
    proxyReq.on('error', (e) => {
      console.error('Proxy error:', e.message)
      res.writeHead(502)
      res.end(JSON.stringify({ error: e.message }))
    })
    if (chunks.length) proxyReq.write(Buffer.concat(chunks))
    proxyReq.end()
  })
})

server.listen(LOCAL_PORT, '127.0.0.1', () => {
  console.log(`Proxy listening on http://127.0.0.1:${LOCAL_PORT} -> ${WSL_HOST}:${WSL_PORT}`)
})
