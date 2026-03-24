import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // @studysprint/shared'i fiziksel yola bağlar
      '@studysprint/shared': path.resolve(__dirname, 'src/shared/src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      // Yerel geliştirme (Local) için proxy ayarı. 
      // Vercel'e yüklendiğinde (Production) Vercel bu proxy'yi değil, vercel.json'u kullanacak.
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
  // Vercel deployment'ı için build ayarları
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})