import { defineStore } from 'pinia'

const MAX_RECENTS = 10

export interface RecentFile {
  path: string
  name: string
  openedAt: number
}

export const useRecentsStore = defineStore('recents', {
  state: () => ({
    files: [] as RecentFile[],
  }),

  getters: {
    recentFiles: (state) => state.files,
  },

  actions: {
    addRecent(path: string) {
      // Extract filename from path
      const name = path.split(/[/\\]/).pop() || path

      // Remove if already exists
      this.files = this.files.filter((f) => f.path !== path)

      // Add to beginning
      this.files.unshift({
        path,
        name,
        openedAt: Date.now(),
      })

      // Limit to max
      if (this.files.length > MAX_RECENTS) {
        this.files = this.files.slice(0, MAX_RECENTS)
      }
    },

    removeRecent(path: string) {
      this.files = this.files.filter((f) => f.path !== path)
    },

    clearRecents() {
      this.files = []
    },
  },

  persist: true,
})
