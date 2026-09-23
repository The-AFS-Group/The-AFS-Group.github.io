import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, host: '0.0.0.0' },
  // xlsx is its own lazy chunk, loaded only when someone uploads a spreadsheet.
  build: { chunkSizeWarningLimit: 600 },
});
