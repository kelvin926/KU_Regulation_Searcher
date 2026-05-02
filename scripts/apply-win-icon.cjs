const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const rcedit = path.join(root, "node_modules", "electron-winstaller", "vendor", "rcedit.exe");
const exe = path.join(root, "release", "win-unpacked", "KU Regulation Searcher.exe");
const icon = path.join(root, "build", "icon.ico");

for (const file of [rcedit, exe, icon]) {
  if (!fs.existsSync(file)) {
    throw new Error(`Required file not found: ${file}`);
  }
}

execFileSync(
  rcedit,
  [
    exe,
    "--set-icon",
    icon,
    "--set-version-string",
    "FileDescription",
    "KU Regulation Searcher",
    "--set-version-string",
    "ProductName",
    "KU Regulation Searcher",
    "--set-version-string",
    "CompanyName",
    "kelvin926",
  ],
  { stdio: "inherit" },
);

console.log(`Applied Windows icon resources to ${exe}`);
