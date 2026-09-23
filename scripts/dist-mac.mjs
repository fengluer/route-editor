import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

if (process.platform !== "darwin") {
  console.error("Mac 安装包只能在 macOS 上打包。");
  console.error("electron-builder 不支持在 Windows 或 Linux 上生成 macOS 应用。");
  console.error("请把项目拷到 Mac，安装 Node.js 后运行：npm run dist:mac");
  process.exit(1);
}

function run(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: "false" },
    });
    child.on("close", (code) => resolve(code ?? 1));
  });
}

const built = await run("npm", ["run", "build"]);
if (built !== 0) process.exit(built);

const packed = await run(process.execPath, [
  path.join(root, "node_modules", "electron-builder", "cli.js"),
  "--mac",
  "--universal",
  "--publish",
  "never",
  ...process.argv.slice(2),
]);
process.exit(packed);
