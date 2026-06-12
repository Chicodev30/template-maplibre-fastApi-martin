import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Porta 80: redirect valido do Keycloak (http://localhost). No Windows pode
  // exigir terminal como administrador ou que a porta 80 esteja livre.
  server: {
    port: 80,
    host: true,
  },
})
