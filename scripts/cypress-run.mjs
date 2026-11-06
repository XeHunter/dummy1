// Runs Cypress via its Module API.
// VS Code's integrated terminal sets ELECTRON_RUN_AS_NODE=1, which makes the
// Cypress (Electron) binary behave like plain Node and fail to start — clear it.
import cypress from "cypress";

delete process.env.ELECTRON_RUN_AS_NODE;

const result = await cypress.run({ browser: "electron" });

if (result.status === "failed") {
  console.error(result.message);
  process.exit(1);
}
process.exit(result.totalFailed > 0 ? 1 : 0);
