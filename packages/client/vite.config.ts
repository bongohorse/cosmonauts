import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages serves from /<repo>/; CI sets BASE_PATH, local stays "/".
  base: process.env.BASE_PATH ?? "/",
  build: {
    target: "esnext",
  },
});
