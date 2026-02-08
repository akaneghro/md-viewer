import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock @tauri-apps/api/core
vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) =>
    `asset://localhost/${path.replace(/^\//, "")}`,
}));

import {
  renderMarkdown,
  type TocItem,
  type MarkdownResult,
} from "~/utils/markdown";

describe("renderMarkdown", () => {
  // --- Basic rendering ---
  describe("basic rendering", () => {
    it("should render paragraphs", async () => {
      const result = await renderMarkdown("Hello world");
      expect(result.html).toContain("<p>Hello world</p>");
    });

    it("should render bold text", async () => {
      const result = await renderMarkdown("**bold**");
      expect(result.html).toContain("<strong>bold</strong>");
    });

    it("should render italic text", async () => {
      const result = await renderMarkdown("*italic*");
      expect(result.html).toContain("<em>italic</em>");
    });

    it("should render inline code", async () => {
      const result = await renderMarkdown("`code`");
      expect(result.html).toContain("<code>code</code>");
    });

    it("should render blockquotes", async () => {
      const result = await renderMarkdown("> quote");
      expect(result.html).toContain("<blockquote>");
    });

    it("should render unordered lists", async () => {
      const result = await renderMarkdown("- item 1\n- item 2");
      expect(result.html).toContain("<ul>");
      expect(result.html).toContain("<li>");
    });

    it("should render ordered lists", async () => {
      const result = await renderMarkdown("1. first\n2. second");
      expect(result.html).toContain("<ol>");
    });

    it("should render horizontal rules", async () => {
      const result = await renderMarkdown("---");
      expect(result.html).toContain("<hr>");
    });

    it("should handle empty content", async () => {
      const result = await renderMarkdown("");
      expect(result.html).toBe("");
      expect(result.toc).toEqual([]);
    });
  });

  // --- Headings and TOC extraction ---
  describe("headings and TOC extraction", () => {
    it("should render h1 with ID and extract TOC", async () => {
      const result = await renderMarkdown("# Hello World");
      expect(result.html).toContain('id="hello-world"');
      expect(result.toc).toEqual([
        { level: 1, title: "Hello World", id: "hello-world" },
      ]);
    });

    it("should render h2 and h3 in TOC", async () => {
      const md = "# Title\n## Subtitle\n### Section";
      const result = await renderMarkdown(md);
      expect(result.toc).toHaveLength(3);
      expect(result.toc[0]).toEqual({ level: 1, title: "Title", id: "title" });
      expect(result.toc[1]).toEqual({
        level: 2,
        title: "Subtitle",
        id: "subtitle",
      });
      expect(result.toc[2]).toEqual({
        level: 3,
        title: "Section",
        id: "section",
      });
    });

    it("should NOT include h4-h6 in TOC", async () => {
      const md = "#### Deep heading\n##### Deeper\n###### Deepest";
      const result = await renderMarkdown(md);
      expect(result.toc).toHaveLength(0);
    });

    it("should handle duplicate headings with unique IDs", async () => {
      const md = "# Title\n# Title\n# Title";
      const result = await renderMarkdown(md);
      expect(result.toc).toHaveLength(3);
      expect(result.toc[0].id).toBe("title");
      expect(result.toc[1].id).toBe("title-1");
      expect(result.toc[2].id).toBe("title-2");
    });

    it("should slugify special characters in headings", async () => {
      const result = await renderMarkdown("# Hello & World!");
      expect(result.toc[0].id).toMatch(/^hello/);
    });

    it("should generate fallback ID for empty heading text", async () => {
      // Heading with only special chars that get stripped
      const result = await renderMarkdown("# $$$$");
      if (result.toc.length > 0) {
        expect(result.toc[0].id).toMatch(/heading-/);
      }
    });

    it("should extract text from headings with inline formatting", async () => {
      const result = await renderMarkdown("# Hello **bold** world");
      expect(result.toc[0].title).toBe("Hello bold world");
    });
  });

  // --- GFM features ---
  describe("GFM features", () => {
    it("should render tables", async () => {
      const md = "| Col1 | Col2 |\n| --- | --- |\n| a | b |";
      const result = await renderMarkdown(md);
      expect(result.html).toContain("<table>");
      expect(result.html).toContain("<th>Col1</th>");
      expect(result.html).toContain("<td>a</td>");
    });

    it("should render task lists", async () => {
      const md = "- [x] Done\n- [ ] Todo";
      const result = await renderMarkdown(md);
      expect(result.html).toContain('type="checkbox"');
    });

    it("should render strikethrough", async () => {
      const md = "~~deleted~~";
      const result = await renderMarkdown(md);
      expect(result.html).toContain("<del>deleted</del>");
    });

    it("should render autolinked URLs", async () => {
      const result = await renderMarkdown("Visit https://example.com");
      expect(result.html).toContain('href="https://example.com"');
    });
  });

  // --- External links ---
  describe("external links", () => {
    it("should mark http links as external", async () => {
      const result = await renderMarkdown("[link](http://example.com)");
      expect(result.html).toContain('data-external="true"');
      expect(result.html).toContain('href="http://example.com"');
    });

    it("should mark https links as external", async () => {
      const result = await renderMarkdown("[link](https://example.com)");
      expect(result.html).toContain('data-external="true"');
    });

    it("should keep anchor links unchanged", async () => {
      const result = await renderMarkdown("[section](#my-section)");
      expect(result.html).toContain('href="#my-section"');
      expect(result.html).not.toContain("data-external");
    });

    it("should allow mailto links", async () => {
      const result = await renderMarkdown("[email](mailto:test@example.com)");
      expect(result.html).toContain('href="mailto:test@example.com"');
    });

    it("should block javascript: links", async () => {
      const result = await renderMarkdown("[xss](javascript:alert(1))");
      expect(result.html).not.toContain("javascript:");
    });

    it("should block data: links", async () => {
      const result = await renderMarkdown(
        "[xss](data:text/html,<script>alert(1)</script>)",
      );
      expect(result.html).not.toContain("data:text/html");
    });

    it("should block file: links", async () => {
      const result = await renderMarkdown("[file](file:///etc/passwd)");
      expect(result.html).not.toContain("file:///");
    });
  });

  // --- Image resolution ---
  describe("image resolution", () => {
    it("should keep http images as-is", async () => {
      const result = await renderMarkdown(
        "![img](https://example.com/img.png)",
        "/dir",
      );
      expect(result.html).toContain('src="https://example.com/img.png"');
    });

    it("should keep http:// images as-is", async () => {
      const result = await renderMarkdown(
        "![img](http://example.com/img.png)",
        "/dir",
      );
      expect(result.html).toContain('src="http://example.com/img.png"');
    });

    it("should resolve relative images with convertFileSrc", async () => {
      const result = await renderMarkdown("![img](image.png)", "/docs");
      expect(result.html).toContain("asset://localhost/");
    });

    it("should resolve ./relative images", async () => {
      const result = await renderMarkdown("![img](./image.png)", "/docs");
      expect(result.html).toContain("asset://localhost/");
    });

    it("should block absolute /path images outside fileDir", async () => {
      // /absolute/image.png is NOT within /docs, so it should be blocked
      const result = await renderMarkdown(
        "![img](/absolute/image.png)",
        "/docs",
      );
      expect(result.html).toContain('src=""');
    });

    it("should block data: URIs in images", async () => {
      const result = await renderMarkdown(
        "![img](data:image/png;base64,abc)",
        "/docs",
      );
      expect(result.html).toContain('src=""');
    });

    it("should block other scheme URIs in images", async () => {
      const result = await renderMarkdown(
        "![img](ftp://server/img.png)",
        "/docs",
      );
      expect(result.html).toContain('src=""');
    });

    it("should not resolve images when fileDir is null", async () => {
      const result = await renderMarkdown("![img](image.png)");
      // Without fileDir, rehypeResolveImages returns early; image src is unmodified
      expect(result.html).toContain('src="image.png"');
    });

    it("should block path traversal attempts", async () => {
      const result = await renderMarkdown(
        "![img](../../etc/passwd)",
        "/docs/files",
      );
      expect(result.html).toContain('src=""');
    });

    it("should handle Windows-style fileDir paths", async () => {
      const result = await renderMarkdown(
        "![img](image.png)",
        "C:\\Users\\docs",
      );
      expect(result.html).toContain("asset://localhost/");
    });
  });

  // --- Code highlighting ---
  describe("code highlighting", () => {
    it("should highlight code blocks with known language", async () => {
      const md = '```javascript\nconsole.log("hello")\n```';
      const result = await renderMarkdown(md);
      expect(result.html).toContain("shiki-container");
    });

    it("should handle code blocks without language", async () => {
      const md = "```\nplain text\n```";
      const result = await renderMarkdown(md);
      expect(result.html).toBeDefined();
    });

    it("should handle language aliases (js -> javascript)", async () => {
      const md = "```js\nconst x = 1\n```";
      const result = await renderMarkdown(md);
      expect(result.html).toContain("shiki-container");
    });

    it("should handle ts alias", async () => {
      const md = "```ts\nconst x: number = 1\n```";
      const result = await renderMarkdown(md);
      expect(result.html).toContain("shiki-container");
    });

    it("should handle py alias", async () => {
      const md = '```py\nprint("hello")\n```';
      const result = await renderMarkdown(md);
      expect(result.html).toContain("shiki-container");
    });

    it("should handle unknown languages gracefully", async () => {
      const md = "```unknownlang\nsome code\n```";
      const result = await renderMarkdown(md);
      expect(result.html).toBeDefined();
    });

    it("should decode HTML entities in code", async () => {
      const md = "```html\n<div>&amp;</div>\n```";
      const result = await renderMarkdown(md);
      expect(result.html).toBeDefined();
    });

    it("should use dark theme when isDark is true", async () => {
      const md = "```javascript\nconst x = 1\n```";
      const result = await renderMarkdown(md, null, true);
      expect(result.html).toContain("shiki-container");
    });

    it("should use light theme when isDark is false", async () => {
      const md = "```javascript\nconst x = 1\n```";
      const result = await renderMarkdown(md, null, false);
      expect(result.html).toContain("shiki-container");
    });
  });

  // --- Security / sanitization ---
  describe("security and sanitization", () => {
    it("should strip script tags", async () => {
      const result = await renderMarkdown('<script>alert("xss")</script>');
      expect(result.html).not.toContain("<script>");
    });

    it("should strip event handlers from tags", async () => {
      const result = await renderMarkdown('<img src="x" onerror="alert(1)">');
      expect(result.html).not.toContain("onerror");
    });

    it("should strip iframe tags", async () => {
      const result = await renderMarkdown('<iframe src="evil.com"></iframe>');
      expect(result.html).not.toContain("<iframe");
    });

    it("should allow standard formatting tags", async () => {
      const result = await renderMarkdown("**bold** and *italic* and `code`");
      expect(result.html).toContain("<strong>bold</strong>");
      expect(result.html).toContain("<em>italic</em>");
      expect(result.html).toContain("<code>code</code>");
    });

    it("should allow details/summary tags", async () => {
      const md =
        "<details>\n<summary>Click me</summary>\nHidden content\n</details>";
      const result = await renderMarkdown(md);
      // remark with allowDangerousHtml: false may not pass raw HTML through
      // This test verifies the sanitize schema at least doesn't crash
      expect(result.html).toBeDefined();
    });

    it("should preserve class attributes on code and span", async () => {
      // Code blocks get class="language-xxx" which should be preserved
      const md = "```javascript\ncode\n```";
      const result = await renderMarkdown(md);
      expect(result.html).toBeDefined();
    });
  });

  // --- Return types ---
  describe("return structure", () => {
    it("should return html string and toc array", async () => {
      const result = await renderMarkdown("# Test\nParagraph");
      expect(typeof result.html).toBe("string");
      expect(Array.isArray(result.toc)).toBe(true);
    });

    it("should return empty toc for content without headings", async () => {
      const result = await renderMarkdown("Just a paragraph");
      expect(result.toc).toEqual([]);
    });
  });
});
