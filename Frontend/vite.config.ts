import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const page = (name: string) => path.resolve(import.meta.dirname, name)

// Four pages share one build: home and sign-in, the shop, the warehouse
// console and the delivery lookup.
export default defineConfig({
  plugins: [react()],
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
})
