import { describe, it, expect, vi, beforeEach } from "vitest";
import { reactive } from "vue";

// Mock Tauri plugins
vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readTextFile: vi.fn(),
  stat: vi.fn(),
  writeTextFile: vi.fn(),
}));

// Mock renderMarkdown
vi.mock("~/utils/markdown", () => ({
  renderMarkdown: vi.fn().mockResolvedValue({
    html: "<p>rendered</p>",
    toc: [{ level: 1, title: "Title", id: "title" }],
  }),
}));

// Mock Pinia store
const mockAddRecent = vi.fn();
const mockRecentsStore = {
  addRecent: mockAddRecent,
  removeRecent: vi.fn(),
  clearRecents: vi.fn(),
  files: [],
  recentFiles: [],
};

vi.mock("~/stores/recents", () => ({
  useRecentsStore: () => mockRecentsStore,
}));

// Mock useColorMode
vi.mock("~/composables/useColorMode", () => ({
  useColorMode: () =>
    reactive({
      value: "light" as const,
      toggle: vi.fn(),
      set: vi.fn(),
    }),
}));

import { useDocument } from "~/composables/useDocument";
import { readTextFile, stat, writeTextFile } from "@tauri-apps/plugin-fs";
import { open, save } from "@tauri-apps/plugin-dialog";
import { renderMarkdown } from "~/utils/markdown";

describe("useDocument", () => {
  let doc: ReturnType<typeof useDocument>;

  beforeEach(() => {
    vi.clearAllMocks();
    doc = useDocument();
    doc.clear();
  });

  // --- Initial state ---
  describe("initial state", () => {
    it("should start with null currentPath", () => {
      expect(doc.currentPath.value).toBeNull();
    });

    it("should start with empty content", () => {
      expect(doc.content.value).toBe("");
    });

    it("should start with empty html", () => {
      expect(doc.html.value).toBe("");
    });

    it("should start with empty toc", () => {
      expect(doc.toc.value).toEqual([]);
    });

    it("should start with no error", () => {
      expect(doc.error.value).toBeNull();
    });

    it("should start not loading", () => {
      expect(doc.isLoading.value).toBe(false);
    });

    it("should start not editing", () => {
      expect(doc.isEditing.value).toBe(false);
    });

    it("should start with empty editContent", () => {
      expect(doc.editContent.value).toBe("");
    });

    it("should start not dirty", () => {
      expect(doc.isDirty.value).toBe(false);
    });

    it("should start with null fileName", () => {
      expect(doc.fileName.value).toBeNull();
    });

    it("should start with null fileDir", () => {
      expect(doc.fileDir.value).toBeNull();
    });
  });

  // --- openPath ---
  describe("openPath", () => {
    it("should read and render a file successfully", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("# Hello");

      await doc.openPath("/path/to/file.md");

      expect(readTextFile).toHaveBeenCalledWith("/path/to/file.md");
      expect(doc.currentPath.value).toBe("/path/to/file.md");
      expect(doc.content.value).toBe("# Hello");
      expect(mockAddRecent).toHaveBeenCalledWith("/path/to/file.md");
    });

    it("should set html and toc after rendering", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("# Hello");

      await doc.openPath("/file.md");

      expect(doc.html.value).toBe("<p>rendered</p>");
      expect(doc.toc.value).toEqual([
        { level: 1, title: "Title", id: "title" },
      ]);
    });

    it("should reject files over size limit", async () => {
      vi.mocked(stat).mockResolvedValue({
        size: 20 * 1024 * 1024,
      } as unknown as Awaited<ReturnType<typeof stat>>);

      await expect(doc.openPath("/huge.md")).rejects.toThrow("File too large");
      expect(doc.error.value).toContain("too large");
    });

    it("should handle read errors", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockRejectedValue(new Error("Permission denied"));

      await expect(doc.openPath("/file.md")).rejects.toThrow();
      expect(doc.error.value).toContain("Failed to open file");
    });

    it("should set isLoading to false after completion", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("content");

      await doc.openPath("/file.md");
      expect(doc.isLoading.value).toBe(false);
    });

    it("should set isLoading to false after error", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockRejectedValue(new Error("fail"));

      await doc.openPath("/file.md").catch(() => {});
      expect(doc.isLoading.value).toBe(false);
    });

    it("should handle stat failures gracefully (scope restrictions)", async () => {
      vi.mocked(stat).mockRejectedValue(new Error("Scope error"));
      vi.mocked(readTextFile).mockResolvedValue("# Works");

      await doc.openPath("/file.md");
      expect(doc.content.value).toBe("# Works");
    });

    it("should clear error before loading", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("ok");

      await doc.openPath("/file.md");
      expect(doc.error.value).toBeNull();
    });
  });

  // --- openDroppedFile ---
  describe("openDroppedFile", () => {
    it("should reject non-markdown files", async () => {
      await expect(doc.openDroppedFile("/file.txt")).rejects.toThrow(
        "Only .md files are supported",
      );
    });

    it("should reject .html files", async () => {
      await expect(doc.openDroppedFile("/file.html")).rejects.toThrow(
        "Only .md files are supported",
      );
    });

    it("should accept .md files", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("content");

      await doc.openDroppedFile("/file.md");
      expect(doc.currentPath.value).toBe("/file.md");
    });

    it("should accept .markdown files", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("content");

      await doc.openDroppedFile("/file.markdown");
      expect(doc.currentPath.value).toBe("/file.markdown");
    });

    it("should accept .mdown files", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("content");

      await doc.openDroppedFile("/file.mdown");
      expect(doc.currentPath.value).toBe("/file.mdown");
    });

    it("should accept .mkd files", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("content");

      await doc.openDroppedFile("/file.mkd");
      expect(doc.currentPath.value).toBe("/file.mkd");
    });
  });

  // --- openWithDialog ---
  describe("openWithDialog", () => {
    it("should throw when user cancels", async () => {
      vi.mocked(open).mockResolvedValue(null);
      await expect(doc.openWithDialog()).rejects.toThrow("User cancelled");
    });

    it("should open the selected file", async () => {
      vi.mocked(open).mockResolvedValue("/selected.md");
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("selected content");

      await doc.openWithDialog();
      expect(doc.currentPath.value).toBe("/selected.md");
      expect(doc.content.value).toBe("selected content");
    });
  });

  // --- openWithContent ---
  describe("openWithContent", () => {
    it("should set path and content without reading file", async () => {
      await doc.openWithContent("/cli-file.md", "# From CLI");

      expect(doc.currentPath.value).toBe("/cli-file.md");
      expect(doc.content.value).toBe("# From CLI");
      expect(readTextFile).not.toHaveBeenCalled();
      expect(mockAddRecent).toHaveBeenCalledWith("/cli-file.md");
    });

    it("should render the provided content", async () => {
      await doc.openWithContent("/file.md", "# Test");

      expect(renderMarkdown).toHaveBeenCalled();
      expect(doc.html.value).toBe("<p>rendered</p>");
    });

    it("should set isLoading to false after completion", async () => {
      await doc.openWithContent("/file.md", "content");
      expect(doc.isLoading.value).toBe(false);
    });

    it("should handle render errors", async () => {
      vi.mocked(renderMarkdown).mockRejectedValueOnce(new Error("render fail"));

      await expect(doc.openWithContent("/file.md", "bad")).rejects.toThrow();
      expect(doc.error.value).toContain("Failed to render markdown");
      expect(doc.isLoading.value).toBe(false);
    });
  });

  // --- fileName computed ---
  describe("fileName", () => {
    it("should extract filename from unix path", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("x");
      await doc.openPath("/path/to/readme.md");
      expect(doc.fileName.value).toBe("readme.md");
    });

    it("should extract filename from windows path", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("x");
      await doc.openPath("C:\\Users\\docs\\readme.md");
      expect(doc.fileName.value).toBe("readme.md");
    });
  });

  // --- fileDir computed ---
  describe("fileDir", () => {
    it("should compute directory from unix path", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("x");
      await doc.openPath("/path/to/readme.md");
      expect(doc.fileDir.value).toBe("/path/to");
    });
  });

  // --- clear ---
  describe("clear", () => {
    it("should reset all state", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("content");
      await doc.openPath("/file.md");

      doc.clear();

      expect(doc.currentPath.value).toBeNull();
      expect(doc.content.value).toBe("");
      expect(doc.html.value).toBe("");
      expect(doc.toc.value).toEqual([]);
      expect(doc.error.value).toBeNull();
      expect(doc.isEditing.value).toBe(false);
      expect(doc.editContent.value).toBe("");
      expect(doc.isDirty.value).toBe(false);
    });
  });

  // --- Editing ---
  describe("editing", () => {
    beforeEach(async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("# Original");
      await doc.openPath("/file.md");
    });

    it("should start editing with current content", () => {
      doc.startEditing();
      expect(doc.isEditing.value).toBe(true);
      expect(doc.editContent.value).toBe("# Original");
      expect(doc.isDirty.value).toBe(false);
    });

    it("should not start editing without a file open", () => {
      doc.clear();
      doc.startEditing();
      expect(doc.isEditing.value).toBe(false);
    });

    it("should update edit content and mark dirty", () => {
      doc.startEditing();
      doc.updateEditContent("# Modified");
      expect(doc.editContent.value).toBe("# Modified");
      expect(doc.isDirty.value).toBe(true);
    });

    it("should stop editing without confirm when not dirty", async () => {
      doc.startEditing();
      const result = await doc.stopEditing();
      expect(result).toBe(true);
      expect(doc.isEditing.value).toBe(false);
    });

    it("should prompt confirm when stopping with dirty changes", async () => {
      doc.startEditing();
      doc.updateEditContent("changed");

      const confirmMock = vi.fn().mockReturnValue(true);
      vi.stubGlobal("confirm", confirmMock);
      const result = await doc.stopEditing();
      expect(result).toBe(true);
      expect(confirmMock).toHaveBeenCalled();
      vi.unstubAllGlobals();
    });

    it("should not stop editing if user cancels confirm", async () => {
      doc.startEditing();
      doc.updateEditContent("changed");

      vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
      const result = await doc.stopEditing();
      expect(result).toBe(false);
      expect(doc.isEditing.value).toBe(true);
      vi.unstubAllGlobals();
    });

    it("should skip confirm with skipConfirm flag", async () => {
      doc.startEditing();
      doc.updateEditContent("changed");

      const confirmMock = vi.fn();
      vi.stubGlobal("confirm", confirmMock);
      const result = await doc.stopEditing(true);
      expect(result).toBe(true);
      expect(confirmMock).not.toHaveBeenCalled();
      expect(doc.isEditing.value).toBe(false);
      vi.unstubAllGlobals();
    });

    it("should clear editContent and isDirty on stopEditing", async () => {
      doc.startEditing();
      doc.updateEditContent("changed");
      await doc.stopEditing(true);
      expect(doc.editContent.value).toBe("");
      expect(doc.isDirty.value).toBe(false);
    });

    it("should re-render from saved content on stopEditing", async () => {
      doc.startEditing();
      vi.clearAllMocks();
      await doc.stopEditing(true);
      expect(renderMarkdown).toHaveBeenCalled();
    });
  });

  // --- saveFile ---
  describe("saveFile", () => {
    it("should write content and update state", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("original");
      vi.mocked(writeTextFile).mockResolvedValue();

      await doc.openPath("/file.md");
      doc.startEditing();
      doc.updateEditContent("modified");
      await doc.saveFile();

      expect(writeTextFile).toHaveBeenCalledWith("/file.md", "modified");
      expect(doc.content.value).toBe("modified");
      expect(doc.isDirty.value).toBe(false);
    });

    it("should not write when no file is open", async () => {
      await doc.saveFile();
      expect(writeTextFile).not.toHaveBeenCalled();
    });

    it("should re-render after saving", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("original");
      vi.mocked(writeTextFile).mockResolvedValue();

      await doc.openPath("/file.md");
      doc.startEditing();
      doc.updateEditContent("modified");
      vi.clearAllMocks();
      await doc.saveFile();

      expect(renderMarkdown).toHaveBeenCalled();
    });
  });

  // --- saveAs ---
  describe("saveAs", () => {
    it("should save to a new path", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("content");
      vi.mocked(save).mockResolvedValue("/new-path.md");
      vi.mocked(writeTextFile).mockResolvedValue();

      await doc.openPath("/file.md");
      doc.startEditing();
      doc.updateEditContent("new content");
      await doc.saveAs();

      expect(writeTextFile).toHaveBeenCalledWith("/new-path.md", "new content");
      expect(doc.currentPath.value).toBe("/new-path.md");
      expect(doc.isDirty.value).toBe(false);
      expect(mockAddRecent).toHaveBeenCalledWith("/new-path.md");
    });

    it("should do nothing if user cancels dialog", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("content");
      vi.mocked(save).mockResolvedValue(null);

      await doc.openPath("/file.md");
      doc.startEditing();
      await doc.saveAs();

      expect(writeTextFile).not.toHaveBeenCalled();
    });
  });

  // --- confirmIfDirty ---
  describe("confirmIfDirty", () => {
    it("should return true when not editing", async () => {
      const result = await doc.confirmIfDirty();
      expect(result).toBe(true);
    });

    it("should return true when editing but not dirty", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("content");
      await doc.openPath("/file.md");
      doc.startEditing();

      const result = await doc.confirmIfDirty();
      expect(result).toBe(true);
    });

    it("should prompt and return true if user confirms", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("content");
      await doc.openPath("/file.md");
      doc.startEditing();
      doc.updateEditContent("changed");

      vi.stubGlobal("confirm", vi.fn().mockReturnValue(true));
      const result = await doc.confirmIfDirty();
      expect(result).toBe(true);
      expect(doc.isEditing.value).toBe(false);
      expect(doc.editContent.value).toBe("");
      expect(doc.isDirty.value).toBe(false);
      vi.unstubAllGlobals();
    });

    it("should prompt and return false if user rejects", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("content");
      await doc.openPath("/file.md");
      doc.startEditing();
      doc.updateEditContent("changed");

      vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
      const result = await doc.confirmIfDirty();
      expect(result).toBe(false);
      vi.unstubAllGlobals();
    });
  });

  // --- render ---
  describe("render", () => {
    it("should clear html and toc when content is empty", async () => {
      await doc.render();
      expect(doc.html.value).toBe("");
      expect(doc.toc.value).toEqual([]);
    });

    it("should call renderMarkdown when content exists", async () => {
      vi.mocked(stat).mockResolvedValue({ size: 100 } as unknown as Awaited<
        ReturnType<typeof stat>
      >);
      vi.mocked(readTextFile).mockResolvedValue("# Test");
      await doc.openPath("/file.md");

      vi.clearAllMocks();
      await doc.render();
      expect(renderMarkdown).toHaveBeenCalled();
    });
  });
});
