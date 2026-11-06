import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:4173",
    specPattern: "cypress/e2e/**/*.cy.js",
    supportFile: "cypress/support/e2e.js",
    viewportWidth: 1366,
    viewportHeight: 820,
    defaultCommandTimeout: 8000,
  },
  // Screen recording of every spec run → cypress/videos/
  video: true,
  videoCompression: false,
  videosFolder: "cypress/videos",
  screenshotsFolder: "cypress/screenshots",
});
