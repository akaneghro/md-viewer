import { describe, it, expect } from "vitest";
import {
  isValidMarkdownFile,
  VALID_MD_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_MB,
} from "~/utils/constants";

describe("constants", () => {
  describe("VALID_MD_EXTENSIONS", () => {
    it("should contain all expected extensions", () => {
      expect(VALID_MD_EXTENSIONS).toContain("md");
      expect(VALID_MD_EXTENSIONS).toContain("markdown");
      expect(VALID_MD_EXTENSIONS).toContain("mdown");
      expect(VALID_MD_EXTENSIONS).toContain("mkd");
      expect(VALID_MD_EXTENSIONS).toHaveLength(4);
    });
  });

  describe("MAX_FILE_SIZE_BYTES", () => {
    it("should be 10 MB in bytes", () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    });
  });

  describe("MAX_FILE_SIZE_MB", () => {
    it("should be 10", () => {
      expect(MAX_FILE_SIZE_MB).toBe(10);
    });
  });

  describe("isValidMarkdownFile", () => {
    it("should return true for .md files", () => {
      expect(isValidMarkdownFile("readme.md")).toBe(true);
    });

    it("should return true for .markdown files", () => {
      expect(isValidMarkdownFile("doc.markdown")).toBe(true);
    });

    it("should return true for .mdown files", () => {
      expect(isValidMarkdownFile("notes.mdown")).toBe(true);
    });

    it("should return true for .mkd files", () => {
      expect(isValidMarkdownFile("file.mkd")).toBe(true);
    });

    it("should be case insensitive", () => {
      expect(isValidMarkdownFile("README.MD")).toBe(true);
      expect(isValidMarkdownFile("file.Md")).toBe(true);
      expect(isValidMarkdownFile("test.MARKDOWN")).toBe(true);
    });

    it("should return false for non-markdown files", () => {
      expect(isValidMarkdownFile("file.txt")).toBe(false);
      expect(isValidMarkdownFile("file.html")).toBe(false);
      expect(isValidMarkdownFile("file.pdf")).toBe(false);
      expect(isValidMarkdownFile("file.docx")).toBe(false);
    });

    it("should return false for files without extension", () => {
      expect(isValidMarkdownFile("README")).toBe(false);
    });

    it("should handle paths with directories", () => {
      expect(isValidMarkdownFile("/home/user/docs/readme.md")).toBe(true);
      expect(isValidMarkdownFile("C:\\Users\\docs\\readme.md")).toBe(true);
    });

    it("should handle empty string", () => {
      expect(isValidMarkdownFile("")).toBe(false);
    });
  });
});
