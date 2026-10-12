import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const page = (name: string) => path.resolve(import.meta.dirname, name)
const defaultApiTarget = 'https://brightbuy-2026.azurewebsites.net'

// Four pages share one build: home and sign-in, the shop, the warehouse
// console and the delivery lookup.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || defaultApiTarget,
          changeOrigin: true,
          configure: proxy => {
            // The browser talks to Vite, so production CORS need not allow an HTTP localhost origin.
            proxy.on('proxyReq', proxyRequest => proxyRequest.removeHeader('origin'))
          },
        },
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: page('index.html'),
          catalogue: page('catalogue.html'),
          inventory: page('inventory.html'),
          delivery: page('delivery.html'),
        },
      },
    },
  }
})
