import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // LAN: второй ПК открывает http://<IP>:5173
  },
});
