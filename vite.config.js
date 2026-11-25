import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/nova-ai-chatbot/',
  build: {
    // The 3D scene and Markdown renderer are lazy-loaded chunks; the initial bundle stays ~300 kB.
    chunkSizeWarningLimit: 1100,
  },
})
