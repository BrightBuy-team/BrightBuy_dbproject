import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { input: { main: path.resolve(import.meta.dirname,'index.html'), catalogue: path.resolve(import.meta.dirname,'catalogue.html'), inventory: path.resolve(import.meta.dirname,'inventory.html'), delivery: path.resolve(import.meta.dirname,'delivery.html') } } },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
})
