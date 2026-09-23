import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const unpackFile = path.join(root, "node_modules", "app-builder-lib", "out", "util", "electronGet.js");
const marker = "windows file lock during electron unpack, retrying";
const needle = [
  "        await fs.rm(dir, { recursive: true, force: true });",
  "        await fs.rename(tmpDir, dir);",
].join("\n");
const replacement = `        for (let attempt = 1; ; attempt++) {
            try {
                await fs.rm(dir, { recursive: true, force: true });
                await fs.rename(tmpDir, dir);
                break;
            }
            catch (err) {
                const retryable = err && (err.code === "EPERM" || err.code === "EACCES" || err.code === "EBUSY");
                if (!retryable || attempt >= 8) {
                    throw err;
                }
                builder_util_1.log.warn({ err, attempt, dir, tmpDir }, "${marker}");
                await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
            }
        }`;

async function patchUnpackRename() {
  const source = await readFile(unpackFile, "utf8");
  if (source.includes(marker)) return;
  if (!source.includes(needle)) {
    console.warn("Could not patch electron-builder unpack rename; continuing with the stock builder.");
    return;
  }
  await writeFile(unpackFile, source.replace(needle, replacement));
}

function runBuilder() {
  return new Promise((resolve) => {
    const child = spawn(
      process.execPath,
      [path.join(root, "node_modules", "electron-builder", "cli.js"), "--win", "nsis"],
      { cwd: root, stdio: "inherit", env: process.env },
    );
    child.on("close", (code) => resolve(code ?? 1));
  });
}

await patchUnpackRename();
process.exit(await runBuilder());
