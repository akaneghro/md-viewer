import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ColorMode } from "~/composables/useColorMode";

// We need to reset the module between tests because useColorMode is a singleton
let useColorMode: typeof import("~/composables/useColorMode").useColorMode;

describe("useColorMode", () => {
  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    document.documentElement.classList.remove("dark");

    const mod = await import("~/composables/useColorMode");
    useColorMode = mod.useColorMode;
  });

  it("should default to light mode when no stored preference", () => {
    // Mock matchMedia to return light preference
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    const colorMode = useColorMode();
    expect(colorMode.value).toBe("light");
    vi.unstubAllGlobals();
  });

  it("should read dark from localStorage", async () => {
    localStorage.setItem("md-viewer-color-mode", "dark");
    vi.resetModules();
    const mod = await import("~/composables/useColorMode");
    const colorMode = mod.useColorMode();
    expect(colorMode.value).toBe("dark");
  });

  it("should read light from localStorage", async () => {
    localStorage.setItem("md-viewer-color-mode", "light");
    vi.resetModules();
    const mod = await import("~/composables/useColorMode");
    const colorMode = mod.useColorMode();
    expect(colorMode.value).toBe("light");
  });

  it("should ignore invalid localStorage values", async () => {
    localStorage.setItem("md-viewer-color-mode", "invalid");
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    vi.resetModules();
    const mod = await import("~/composables/useColorMode");
    const colorMode = mod.useColorMode();
    // Falls through to system preference (light)
    expect(colorMode.value).toBe("light");
    vi.unstubAllGlobals();
  });

  it("should toggle between dark and light", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    const colorMode = useColorMode();
    expect(colorMode.value).toBe("light");

    colorMode.toggle();
    expect(colorMode.value).toBe("dark");

    colorMode.toggle();
    expect(colorMode.value).toBe("light");
    vi.unstubAllGlobals();
  });

  it("should persist to localStorage on toggle", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    const colorMode = useColorMode();
    colorMode.toggle();
    expect(localStorage.getItem("md-viewer-color-mode")).toBe("dark");
    vi.unstubAllGlobals();
  });

  it("should add dark class to document on toggle to dark", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    const colorMode = useColorMode();
    colorMode.toggle();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    vi.unstubAllGlobals();
  });

  it("should remove dark class on toggle to light", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    const colorMode = useColorMode();
    colorMode.toggle();
    colorMode.toggle();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    vi.unstubAllGlobals();
  });

  it("should set mode explicitly with set()", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    const colorMode = useColorMode();
    colorMode.set("dark");
    expect(colorMode.value).toBe("dark");
    expect(localStorage.getItem("md-viewer-color-mode")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    vi.unstubAllGlobals();
  });

  it("should set light mode explicitly", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    const colorMode = useColorMode();
    colorMode.set("dark");
    colorMode.set("light");
    expect(colorMode.value).toBe("light");
    expect(localStorage.getItem("md-viewer-color-mode")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    vi.unstubAllGlobals();
  });

  it("should detect system dark preference", async () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    vi.resetModules();
    const mod = await import("~/composables/useColorMode");
    const colorMode = mod.useColorMode();
    expect(colorMode.value).toBe("dark");
    vi.unstubAllGlobals();
  });

  it("should detect system light preference", async () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    vi.resetModules();
    const mod = await import("~/composables/useColorMode");
    const colorMode = mod.useColorMode();
    expect(colorMode.value).toBe("light");
    vi.unstubAllGlobals();
  });

  it("should prefer localStorage over system preference", async () => {
    localStorage.setItem("md-viewer-color-mode", "light");
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    vi.resetModules();
    const mod = await import("~/composables/useColorMode");
    const colorMode = mod.useColorMode();
    expect(colorMode.value).toBe("light");
    vi.unstubAllGlobals();
  });

  it("should apply dark class on initialization when stored mode is dark", async () => {
    localStorage.setItem("md-viewer-color-mode", "dark");
    vi.resetModules();
    document.documentElement.classList.remove("dark");
    const mod = await import("~/composables/useColorMode");
    mod.useColorMode();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("should return same instance on multiple calls (singleton)", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    const a = useColorMode();
    const b = useColorMode();
    a.toggle();
    expect(b.value).toBe("dark");
    vi.unstubAllGlobals();
  });
});
