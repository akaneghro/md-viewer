import { defineConfig } from "vitest/config";
import { resolve } from "path";
import AutoImport from "unplugin-auto-import/vite";

export default defineConfig({
  plugins: [
    AutoImport({
      imports: [
        "vue",
        {
          "~/composables/useColorMode": ["useColorMode"],
          "~/composables/useDocument": ["useDocument"],
        },
      ],
      dts: false,
    }),
    {
      name: "nuxt-import-meta",
      enforce: "pre",
      transform(code: string, id: string) {
        if (id.includes("node_modules")) return null;
        const transformed = code
          .replaceAll("import.meta.client", "(true)")
          .replaceAll("import.meta.server", "(false)");
        return transformed !== code ? transformed : null;
      },
    },
  ],
  resolve: {
    alias: {
      "~": resolve(__dirname, "app"),
    },
  },
  test: {
    environment: "happy-dom",
    globals: true,
    include: ["app/**/__tests__/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary"],
      include: [
        "app/utils/**/*.ts",
        "app/composables/**/*.ts",
        "app/stores/**/*.ts",
      ],
      exclude: ["**/__tests__/**", "**/*.d.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
