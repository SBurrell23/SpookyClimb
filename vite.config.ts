import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // Ensure correct asset paths when deployed to GitHub Pages under /SpookyClimb/
  base: '/SpookyClimb/',
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
