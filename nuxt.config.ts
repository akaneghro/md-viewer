import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: [
    '@pinia/nuxt',
  ],

  // SPA mode for Tauri
  ssr: false,
  devtools: { enabled: false },

  css: ['~/assets/css/main.css'],
  compatibilityDate: '2026-10-01',

  // Nitro configuration for static generation
  nitro: {
    prerender: {
      crawlLinks: false,
      routes: ['/'],
    },
  },

  // Vite configuration for Tauri
  vite: {
    plugins: [tailwindcss()],
    clearScreen: false,
    server: {
      strictPort: true,
    },
    envPrefix: ['VITE_', 'TAURI_'],
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
})
