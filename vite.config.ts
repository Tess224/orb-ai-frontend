import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // 1. This handles the "Buffer is not defined" error
      // 2. This handles the "global is not defined" error
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // We are letting it include defaults to be safe, rather than restricting it
      protocolImports: true,
    })
  ],
  // This is a "belt and suspenders" fix to ensure 'global' points to 'window'
  define: {
    'global': 'window',
  },
})


