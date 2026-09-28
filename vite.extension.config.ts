import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// 크롬 확장(Manifest V3)용 별도 빌드 설정.
// extension/public/* (manifest.json, icons, mediapipe wasm)은
// vite가 자동으로 dist-extension/ 루트에 그대로 복사해준다.
export default defineConfig({
  root: resolve(__dirname, 'extension'),
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'dist-extension'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'extension/popup.html'),
        permission: resolve(__dirname, 'extension/permission.html'),
        preview: resolve(__dirname, 'extension/preview.html'),
        offscreen: resolve(__dirname, 'extension/offscreen.html'),
        background: resolve(__dirname, 'extension/background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
})
