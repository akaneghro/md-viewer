import { describe, it, expect, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useRecentsStore } from "~/stores/recents";

describe("useRecentsStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("should start with empty files", () => {
    const store = useRecentsStore();
    expect(store.files).toEqual([]);
    expect(store.recentFiles).toEqual([]);
  });

  describe("addRecent", () => {
    it("should add a file to recents", () => {
      const store = useRecentsStore();
      store.addRecent("/path/to/file.md");
      expect(store.files).toHaveLength(1);
      expect(store.files[0].path).toBe("/path/to/file.md");
      expect(store.files[0].name).toBe("file.md");
    });

    it("should extract filename from unix path", () => {
      const store = useRecentsStore();
      store.addRecent("/home/user/docs/readme.md");
      expect(store.files[0].name).toBe("readme.md");
    });

    it("should extract filename from windows path", () => {
      const store = useRecentsStore();
      store.addRecent("C:\\Users\\docs\\readme.md");
      expect(store.files[0].name).toBe("readme.md");
    });

    it("should use full path as name when no separator", () => {
      const store = useRecentsStore();
      store.addRecent("file.md");
      expect(store.files[0].name).toBe("file.md");
    });

    it("should add to the beginning (most recent first)", () => {
      const store = useRecentsStore();
      store.addRecent("/first.md");
      store.addRecent("/second.md");
      expect(store.files[0].path).toBe("/second.md");
      expect(store.files[1].path).toBe("/first.md");
    });

    it("should not duplicate paths (move to top instead)", () => {
      const store = useRecentsStore();
      store.addRecent("/file.md");
      store.addRecent("/other.md");
      store.addRecent("/file.md");
      expect(store.files).toHaveLength(2);
      expect(store.files[0].path).toBe("/file.md");
      expect(store.files[1].path).toBe("/other.md");
    });

    it("should limit to 10 entries", () => {
      const store = useRecentsStore();
      for (let i = 0; i < 15; i++) {
        store.addRecent(`/file${i}.md`);
      }
      expect(store.files).toHaveLength(10);
      // Most recent should be first
      expect(store.files[0].path).toBe("/file14.md");
    });

    it("should set openedAt timestamp", () => {
      const store = useRecentsStore();
      const before = Date.now();
      store.addRecent("/file.md");
      const after = Date.now();
      expect(store.files[0].openedAt).toBeGreaterThanOrEqual(before);
      expect(store.files[0].openedAt).toBeLessThanOrEqual(after);
    });
  });

  describe("removeRecent", () => {
    it("should remove a file by path", () => {
      const store = useRecentsStore();
      store.addRecent("/file1.md");
      store.addRecent("/file2.md");
      store.removeRecent("/file1.md");
      expect(store.files).toHaveLength(1);
      expect(store.files[0].path).toBe("/file2.md");
    });

    it("should do nothing if path not found", () => {
      const store = useRecentsStore();
      store.addRecent("/file.md");
      store.removeRecent("/nonexistent.md");
      expect(store.files).toHaveLength(1);
    });
  });

  describe("clearRecents", () => {
    it("should clear all recents", () => {
      const store = useRecentsStore();
      store.addRecent("/file1.md");
      store.addRecent("/file2.md");
      store.addRecent("/file3.md");
      store.clearRecents();
      expect(store.files).toEqual([]);
    });
  });

  describe("recentFiles getter", () => {
    it("should return the same files array", () => {
      const store = useRecentsStore();
      store.addRecent("/file.md");
      expect(store.recentFiles).toEqual(store.files);
    });
  });
});
