import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const workerDir = resolve(projectRoot, "cloudflare-worker-proxy");
const defaultHtmlPath = resolve(projectRoot, "tmp/mali-usage-report.html");
const defaultCsvPath = resolve(projectRoot, "tmp/mali-usage-report.csv");

const getArgument = (args, name, fallback = "") => {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};

const printHelp = () => {
  console.log(`MaliPhone D1 usage report

Reads metadata-only AI usage from the remote D1 database using your existing Wrangler login.
Generated files stay under tmp/ (which is git-ignored).

Usage:
  npm run report:mali-usage
  npm run report:mali-usage -- --limit 500
  npm run report:mali-usage -- --out C:\\Temp\\mali-usage.html --csv C:\\Temp\\mali-usage.csv
`);
};

const args = process.argv.slice(2);
if (args.includes("--help") || args.includes("-h")) {
  printHelp();
  process.exit(0);
}

const parsedLimit = Number.parseInt(getArgument(args, "--limit", "500"), 10);
const limit = Math.min(5000, Math.max(1, Number.isFinite(parsedLimit) ? parsedLimit : 500));
const htmlPath = resolve(projectRoot, getArgument(args, "--out", "tmp/mali-usage-report.html"));
const csvPath = resolve(projectRoot, getArgument(args, "--csv", "tmp/mali-usage-report.csv"));

const sql = `SELECT
  r.created_at,
  r.completed_at,
  r.user_id,
  a.email AS account_email,
  r.app_id,
  r.action_id,
  r.feature,
  r.mode,
  r.request_type,
  r.provider_id,
  r.model,
  r.input_chars,
  r.output_chars,
  r.estimated_input_tokens,
  r.input_tokens,
  r.output_tokens,
  r.total_tokens,
  r.reasoning_tokens,
  r.cached_tokens,
  r.points_charged,
  r.points_refunded,
  r.latency_ms,
  r.generation_id,
  r.status,
  r.error_code
FROM ai_usage_requests AS r
LEFT JOIN mali_test_accounts AS a ON a.user_id = r.user_id
ORDER BY r.created_at DESC
LIMIT ${limit}`;

const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const command = spawnSync(executable, [
  "--yes",
  "wrangler",
  "d1",
  "execute",
  "maliphone-data",
  "--remote",
  "--json",
  "--command",
  sql,
], {
  cwd: workerDir,
  encoding: "utf8",
  windowsHide: true,
  env: { ...process.env, NO_COLOR: "1" },
});

if (command.error) throw command.error;
if (command.status !== 0) {
  throw new Error(String(command.stderr || command.stdout || "Wrangler D1 query failed").trim());
}

const parseWranglerJson = (output) => {
  const text = String(output || "").trim();
  const candidates = [text];
  const arrayStart = text.indexOf("[");
  const objectStart = text.indexOf("{");
  if (arrayStart > 0) candidates.push(text.slice(arrayStart));
  if (objectStart > 0) candidates.push(text.slice(objectStart));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch (_) {}
  }
  throw new Error("Wrangler returned an unexpected JSON response");
};

const payload = parseWranglerJson(command.stdout);
const blocks = Array.isArray(payload) ? payload : [payload];
const rows = blocks.flatMap((block) => (
  Array.isArray(block?.results)
    ? block.results
    : Array.isArray(block?.result?.results) ? block.result.results : []
));

const columns = [
  "created_at", "completed_at", "user_id", "account_email", "app_id", "action_id",
  "feature", "mode", "request_type", "provider_id", "model", "input_chars",
  "output_chars", "estimated_input_tokens", "input_tokens", "output_tokens",
  "total_tokens", "reasoning_tokens", "cached_tokens", "points_charged",
  "points_refunded", "latency_ms", "generation_id", "status", "error_code",
];

const normalizedRows = rows.map((row) => Object.fromEntries(columns.map((column) => [column, row?.[column] ?? ""])));
const htmlEscape = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");
const csvEscape = (value) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const jsonForHtml = JSON.stringify(normalizedRows).replaceAll("<", "\\u003c");
const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>MaliPhone AI 用量報表</title>
<style>
:root { color-scheme: dark; font-family: "Segoe UI", system-ui, sans-serif; background: #171321; color: #f4edf8; }
body { margin: 0; padding: 28px; background: linear-gradient(135deg, #171321, #282039); }
main { max-width: 1500px; margin: 0 auto; }
h1 { margin: 0 0 6px; font-size: 24px; }
.sub { color: #c8b9d3; font-size: 13px; margin-bottom: 20px; }
.cards { display: grid; grid-template-columns: repeat(4, minmax(130px, 1fr)); gap: 10px; margin-bottom: 16px; }
.card { border: 1px solid #4e3b61; border-radius: 14px; background: #241b32; padding: 12px 14px; }
.card b { display: block; font-size: 21px; margin-top: 5px; }
.card span { color: #c8b9d3; font-size: 11px; }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
input, select { border: 1px solid #5b4770; border-radius: 9px; padding: 9px 10px; background: #21182f; color: #f4edf8; }
input { flex: 1 1 260px; }
.table-wrap { overflow: auto; border: 1px solid #4e3b61; border-radius: 14px; background: #21182f; }
table { border-collapse: collapse; width: 100%; min-width: 1100px; font-size: 12px; }
th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid #3a2c49; white-space: nowrap; }
th { position: sticky; top: 0; background: #302342; color: #f5b2d1; }
td.mono { font-family: Consolas, monospace; font-size: 11px; }
.empty { padding: 28px; text-align: center; color: #c8b9d3; }
@media (max-width: 700px) { body { padding: 16px; } .cards { grid-template-columns: repeat(2, 1fr); } }
</style>
</head>
<body>
<main>
  <h1>MaliPhone AI 用量報表</h1>
  <div class="sub">只包含 APP／動作、模型、token、點數與時間；不包含提示詞或生成內容。時間以 UTC 顯示。</div>
  <section class="cards">
    <div class="card"><span>請求數</span><b id="count">0</b></div>
    <div class="card"><span>扣除點數</span><b id="points">0</b></div>
    <div class="card"><span>總 token</span><b id="tokens">0</b></div>
    <div class="card"><span>成功率</span><b id="success">0%</b></div>
  </section>
  <div class="toolbar">
    <input id="search" placeholder="搜尋帳號、APP、動作、模型、request ID…">
    <select id="app"><option value="">全部 APP</option></select>
    <select id="status"><option value="">全部狀態</option><option value="succeeded">succeeded</option><option value="failed">failed</option><option value="reserved">reserved</option></select>
  </div>
  <div class="table-wrap"><table><thead><tr>
    <th>時間（UTC）</th><th>帳號</th><th>APP／動作</th><th>模型</th><th>模式</th><th>輸入字數</th><th>輸出字數</th><th>總 token</th><th>點數</th><th>狀態</th><th>generation ID</th>
  </tr></thead><tbody id="body"></tbody></table><div id="empty" class="empty" hidden>沒有符合條件的紀錄</div></div>
</main>
<script>
const rows = ${jsonForHtml};
const body = document.getElementById("body");
const empty = document.getElementById("empty");
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
const number = (value) => Number(value || 0).toLocaleString();
const getText = (row) => [row.account_email, row.user_id, row.app_id, row.action_id, row.model, row.request_id, row.generation_id].join(" ").toLowerCase();
const appSelect = document.getElementById("app");
[...new Set(rows.map((row) => row.app_id).filter(Boolean))].sort().forEach((app) => { const option = document.createElement("option"); option.value = app; option.textContent = app; appSelect.appendChild(option); });
function render() {
  const query = document.getElementById("search").value.trim().toLowerCase();
  const app = appSelect.value;
  const status = document.getElementById("status").value;
  const filtered = rows.filter((row) => (!query || getText(row).includes(query)) && (!app || row.app_id === app) && (!status || row.status === status));
  const totalPoints = filtered.reduce((sum, row) => sum + Number(row.points_charged || 0), 0);
  const totalTokens = filtered.reduce((sum, row) => sum + Number(row.total_tokens || 0), 0);
  const successCount = filtered.filter((row) => row.status === "succeeded").length;
  document.getElementById("count").textContent = number(filtered.length);
  document.getElementById("points").textContent = number(totalPoints);
  document.getElementById("tokens").textContent = number(totalTokens);
  document.getElementById("success").textContent = filtered.length ? Math.round(successCount / filtered.length * 100) + "%" : "0%";
  body.innerHTML = filtered.map((row) => [
    '<tr>',
    '<td class="mono">' + escapeHtml(row.created_at) + '<br><small>' + escapeHtml(row.completed_at) + '</small></td>',
    '<td>' + escapeHtml(row.account_email || row.user_id) + '</td>',
    '<td><b>' + escapeHtml(row.app_id) + '</b><br>' + escapeHtml(row.action_id) + '</td>',
    '<td>' + escapeHtml(row.model || row.provider_id) + '</td>',
    '<td>' + escapeHtml(row.mode) + '</td>',
    '<td>' + number(row.input_chars) + '</td><td>' + number(row.output_chars) + '</td><td>' + number(row.total_tokens) + '</td>',
    '<td>' + number(row.points_charged) + (Number(row.points_refunded || 0) ? ' / refund ' + number(row.points_refunded) : '') + '</td>',
    '<td>' + escapeHtml(row.status) + (row.error_code ? '<br>' + escapeHtml(row.error_code) : '') + '</td>',
    '<td class="mono">' + escapeHtml(row.generation_id) + '</td>',
    '</tr>',
  ].join('')).join('');
  empty.hidden = filtered.length > 0;
}
document.getElementById("search").addEventListener("input", render);
appSelect.addEventListener("change", render);
document.getElementById("status").addEventListener("change", render);
render();
</script>
</body>
</html>`;

const csv = [columns.join(","), ...normalizedRows.map((row) => columns.map((column) => csvEscape(row[column])).join(","))].join("\r\n");
await mkdir(dirname(htmlPath), { recursive: true });
await mkdir(dirname(csvPath), { recursive: true });
await writeFile(htmlPath, html, "utf8");
await writeFile(csvPath, csv, "utf8");
console.log(`MaliPhone usage report created (${normalizedRows.length} rows)`);
console.log(`HTML: ${htmlPath}`);
console.log(`CSV:  ${csvPath}`);
