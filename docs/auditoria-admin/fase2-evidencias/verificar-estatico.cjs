// Local static checks; no application startup, environment loading or network.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "../../..");
const { ESLint } = require(path.join(root, "frontend/node_modules/eslint"));
const backend = [
  "controllers/adminAlertController.js", "controllers/checkoutController.js",
  "controllers/dashboardAdminController.js", "controllers/orderAdminController.js",
  "controllers/notificationAdminController.js", "models/order.js", "models/paymentEvent.js",
  "models/notification.js", "routes/adminOrderRoutes.js", "server.js",
  "services/emailService.js", "services/orderOperations.js", "services/orderReceiptService.js",
  "services/orderService.js", "services/wompiPaymentService.js", "services/wompiService.js",
  "services/notificationEvents.js", "services/notificationDelivery.js", "services/notificationTemplates.js",
].map((file) => `backend/src/${file}`);
const nodeFiles = [...backend, "backend/test/phase2.test.js", "backend/test/phase2-compatibility.test.js",
  "backend/test/helpers/phase2Fixture.cjs", "frontend/test/communications-browser.cjs",
  "docs/auditoria-admin/fase2-evidencias/build-fase2.cjs",
  "docs/auditoria-admin/fase2-evidencias/verificar-estatico.cjs"];
const frontend = ["src/app/admin/alertas/page.js", "src/components/admin/AlertBell.jsx",
  "src/components/admin/OrderDetail.jsx", "src/components/admin/OrderCommunications.jsx",
  "src/components/admin/CommunicationAlerts.jsx", "src/services/orderAdminService.js"];
const write = (file, data) => fs.writeFileSync(path.join(__dirname, file), `${JSON.stringify(data, null, 2)}\n`);
const compact = (rows) => rows.map(({ filePath, messages, errorCount, warningCount }) => ({
  file: path.relative(root, filePath).replaceAll("\\", "/"), messages, errorCount, warningCount,
}));
const counts = (rows) => ({ errors: rows.reduce((n, r) => n + r.errorCount, 0), warnings: rows.reduce((n, r) => n + r.warningCount, 0) });
// Hook diagnostics embed a source frame with shifted line numbers. Compare
// rule + diagnostic title; retain full frames in both evidence files.
const signatures = (rows) => rows.flatMap((r) => r.messages.map((m) => `${r.file}:${m.severity}:${m.ruleId}:${m.message.split("\n\n")[0]}`)).sort();
async function baseline(linter, files, cwd) {
  const rows = [];
  for (const file of files) {
    const relative = path.relative(root, path.resolve(cwd, file)).replaceAll("\\", "/");
    const prior = spawnSync("git", ["show", `HEAD:${relative}`], { cwd: root, encoding: "utf8" });
    if (prior.status === 0) rows.push(...await linter.lintText(prior.stdout, { filePath: path.resolve(cwd, file) }));
  }
  return compact(rows);
}
async function main() {
  const syntax = nodeFiles.map((file) => {
    const result = spawnSync(process.execPath, ["--check", file], { cwd: root, encoding: "utf8" });
    return { file, exitCode: result.status, error: result.stderr || "" };
  });
  write("sintaxis.json", syntax);
  const nodeLint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: [{
    files: ["**/*.js", "**/*.cjs"], languageOptions: { ecmaVersion: "latest", sourceType: "commonjs" },
    rules: { "no-unreachable": "error", "no-dupe-keys": "error", "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }] },
  }] });
  const frontLint = new ESLint({ cwd: path.join(root, "frontend") });
  const nodeRows = compact(await nodeLint.lintFiles(nodeFiles));
  // Next's Babel parser resolves its preset against process.cwd(), too.
  process.chdir(path.join(root, "frontend"));
  const frontRows = compact(await frontLint.lintFiles(frontend));
  const oldNode = await baseline(nodeLint, nodeFiles, root);
  const oldFront = await baseline(frontLint, frontend, path.join(root, "frontend"));
  write("eslint-node.json", nodeRows); write("eslint-node-antes.json", oldNode);
  write("eslint-frontend.json", frontRows); write("eslint-frontend-antes.json", oldFront);
  const newMessages = [...signatures(nodeRows).filter((s) => !signatures(oldNode).includes(s)),
    ...signatures(frontRows).filter((s) => !signatures(oldFront).includes(s))];
  const result = { syntaxFiles: syntax.length, syntaxFailures: syntax.filter((r) => r.exitCode !== 0).length,
    node: counts(nodeRows), nodeBaseline: counts(oldNode), frontend: counts(frontRows), frontendBaseline: counts(oldFront), newMessages };
  write("estatico-resumen.json", result);
  console.log(JSON.stringify(result, null, 2));
  if (result.syntaxFailures || newMessages.length) process.exitCode = 1;
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
