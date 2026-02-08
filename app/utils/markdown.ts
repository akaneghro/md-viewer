import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { Element, Root } from "hast";
import type { Plugin } from "unified";

export interface TocItem {
  level: number;
  title: string;
  id: string;
}

export interface MarkdownResult {
  html: string;
  toc: TocItem[];
}

// Custom sanitize schema that allows more elements for markdown
const sanitizeSchema = {
  ...defaultSchema,
  clobber: [], // Don't prefix id attributes — we generate them ourselves from heading text
  protocols: {
    ...defaultSchema.protocols,
    src: [...(defaultSchema.protocols?.src || []), "asset"],
  },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "input", // For tasklists
    "details",
    "summary",
  ],
  attributes: {
    ...defaultSchema.attributes,
    a: [...(defaultSchema.attributes?.a || []), "data-external"],
    input: ["type", "checked", "disabled"],
    code: [...(defaultSchema.attributes?.code || []), "className"],
    span: [...(defaultSchema.attributes?.span || []), "className", "style"],
    pre: [...(defaultSchema.attributes?.pre || []), "className", "style"],
    "*": ["id", "className"],
  },
};

// Generate slug from text
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// Extract text from heading node
function extractText(node: Element): string {
  let text = "";
  visit(node, "text", (textNode: { value: string }) => {
    text += textNode.value;
  });
  return text;
}

// Plugin to add IDs to headings and extract TOC
function rehypeHeadingIds(toc: TocItem[]): Plugin<[], Root> {
  const usedIds = new Set<string>();

  return () => (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      const match = node.tagName.match(/^h([1-6])$/);
      if (match) {
        const level = parseInt(match[1], 10);
        if (level <= 3) {
          const title = extractText(node);
          let id = slugify(title) || `heading-${usedIds.size}`;

          // Ensure unique ID
          let counter = 1;
          const baseId = id;
          while (usedIds.has(id)) {
            id = `${baseId}-${counter}`;
            counter++;
          }
          usedIds.add(id);

          // Add ID to heading
          node.properties = node.properties || {};
          node.properties.id = id;

          // Add to TOC
          toc.push({ level, title, id });
        }
      }
    });
  };
}

// Normalize a path by resolving . and .. segments
function normalizePath(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (part === "." || part === "") continue;
    if (part === "..") {
      resolved.pop();
    } else {
      resolved.push(part);
    }
  }
  // Preserve leading slash for absolute paths
  const prefix = path.startsWith("/") ? "/" : "";
  return prefix + resolved.join("/");
}

// Plugin to resolve relative image paths
function rehypeResolveImages(fileDir: string | null): Plugin<[], Root> {
  return () => (tree: Root) => {
    if (!fileDir) return;

    const normalizedDir = normalizePath(fileDir.replace(/\\/g, "/"));

    visit(tree, "element", (node: Element) => {
      if (node.tagName === "img" && node.properties?.src) {
        const src = String(node.properties.src);

        // Only allow http(s) URLs for remote images
        if (src.startsWith("http://") || src.startsWith("https://")) {
          return;
        }

        // Block data: URIs and other schemes in images
        if (src.includes(":")) {
          node.properties.src = "";
          return;
        }

        // Resolve relative path
        let absolutePath: string;

        if (src.startsWith("/")) {
          absolutePath = src;
        } else if (src.startsWith("./")) {
          absolutePath = `${normalizedDir}/${src.slice(2)}`;
        } else {
          absolutePath = `${normalizedDir}/${src}`;
        }

        // Normalize to resolve any .. segments
        absolutePath = normalizePath(absolutePath);

        // Validate: resolved path must stay within the file's directory
        if (!absolutePath.startsWith(normalizedDir)) {
          node.properties.src = "";
          return;
        }

        // Convert to asset URL for Tauri
        node.properties.src = convertFileSrc(absolutePath);
      }
    });
  };
}

// Plugin to add target="_blank" to external links and handle dangerous schemes
const rehypeExternalLinks: Plugin<[], Root> = () => (tree: Root) => {
  visit(tree, "element", (node: Element) => {
    if (node.tagName === "a" && node.properties?.href) {
      const href = String(node.properties.href);

      // Whitelist: only allow safe schemes and internal anchors
      if (
        !href.startsWith("http://") &&
        !href.startsWith("https://") &&
        !href.startsWith("#") &&
        !href.startsWith("mailto:")
      ) {
        node.properties.href = "#";
        return;
      }

      // Mark external links
      if (href.startsWith("http://") || href.startsWith("https://")) {
        node.properties["data-external"] = "true";
      }
    }
  });
};

let shikiHighlighter: Awaited<
  ReturnType<typeof import("shiki").createHighlighter>
> | null = null;

async function getHighlighter() {
  if (!shikiHighlighter) {
    const { createHighlighter } = await import("shiki");
    shikiHighlighter = await createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: [
        "javascript",
        "typescript",
        "python",
        "rust",
        "go",
        "java",
        "c",
        "cpp",
        "csharp",
        "php",
        "ruby",
        "swift",
        "kotlin",
        "json",
        "yaml",
        "xml",
        "html",
        "css",
        "scss",
        "sql",
        "bash",
        "shell",
        "powershell",
        "markdown",
        "dockerfile",
        "graphql",
        "vue",
        "jsx",
        "tsx",
      ],
    });
  }
  return shikiHighlighter;
}

// Highlight code blocks with Shiki (post-process)
async function highlightCodeBlocks(
  html: string,
  isDark: boolean,
): Promise<string> {
  const highlighter = await getHighlighter();
  const theme = isDark ? "github-dark" : "github-light";

  // Match <pre><code class="language-xxx">...</code></pre>
  const codeBlockRegex =
    /<pre><code(?:\s+class="language-(\w+)")?>([\s\S]*?)<\/code><\/pre>/g;

  const langAliases: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    py: "python",
    rb: "ruby",
    sh: "bash",
    zsh: "bash",
    yml: "yaml",
  };

  const matches: { full: string; lang: string; code: string }[] = [];
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(html)) !== null) {
    matches.push({
      full: match[0],
      lang: match[1] || "text",
      code: match[2],
    });
  }

  let result = html;
  for (const m of matches) {
    let lang = langAliases[m.lang] || m.lang;

    // Decode HTML entities
    const code = m.code
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");

    try {
      const loadedLangs = highlighter.getLoadedLanguages();
      if (!loadedLangs.includes(lang as never)) {
        lang = "text";
      }

      const highlighted = highlighter.codeToHtml(code, { lang, theme });
      result = result.replace(
        m.full,
        `<div class="shiki-container">${highlighted}</div>`,
      );
    } catch {
      // Keep original if highlighting fails
    }
  }

  return result;
}

export async function renderMarkdown(
  content: string,
  fileDir: string | null = null,
  isDark: boolean = false,
): Promise<MarkdownResult> {
  const toc: TocItem[] = [];

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: false })
    .use(rehypeHeadingIds(toc))
    .use(rehypeResolveImages(fileDir))
    .use(rehypeExternalLinks)
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify);

  const result = await processor.process(content);
  let html = String(result);

  // Apply Shiki highlighting
  html = await highlightCodeBlocks(html, isDark);

  return {
    html,
    toc,
  };
}
