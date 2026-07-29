import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// NOTE: the AI Studio scaffold injected GEMINI_API_KEY into the bundle via
// `define`. Nothing in this app uses it, and this repo is PUBLIC — baking a key
// into the built JS is exactly how the Meta token leaked in July 2026. The
// injection has been removed deliberately. Do not reinstate it.
export default defineConfig({
  server: { port: 3000, host: '0.0.0.0' },
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
