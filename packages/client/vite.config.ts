import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages serves from /<repo>/; CI sets BASE_PATH, local stays "/".
  base: process.env.BASE_PATH ?? "/",
  build: {
    target: "esnext",
  },
  // Vitest runs this package's tests in the default "node" environment, so
  // client tests must stay DOM-free (e.g. editor/doc.test.ts only parses data).
  // To test code that touches document/window/localStorage, add jsdom
  // (`pnpm add -wD jsdom`) and set `test: { environment: "jsdom" }` here.
});
