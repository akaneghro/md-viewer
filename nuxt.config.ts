// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },

  // SPA mode for Tauri
  ssr: false,

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
  ],

  // App directory structure
  srcDir: 'app/',

  // Vite configuration for Tauri
  vite: {
    clearScreen: false,
    server: {
      strictPort: true,
    },
    envPrefix: ['VITE_', 'TAURI_'],
  },

  // Nitro configuration for static generation
  nitro: {
    prerender: {
      crawlLinks: false,
      routes: ['/'],
    },
  },

  // TypeScript
  typescript: {
    strict: true,
  },
})
