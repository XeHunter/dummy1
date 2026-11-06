import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths so the build works at a domain root or a sub-path
  // (e.g. GitHub Pages: https://<user>.github.io/<repo>/).
  base: "./",
});
