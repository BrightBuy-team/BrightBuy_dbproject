import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const page = (name: string) => path.resolve(import.meta.dirname, name)

// One build, five pages: home and sign-in, the shop, the staff console
// (inventory.html is its old address), and the delivery lookup.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: page('index.html'),
        catalogue: page('catalogue.html'),
        console: page('console.html'),
        inventory: page('inventory.html'),
        delivery: page('delivery.html'),
      },
    },
  },
})
