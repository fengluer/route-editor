#!/bin/bash
cd "$(dirname "$0")"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "这个脚本只能在 Mac 上运行。"
  echo "Windows 不能打出 Mac 安装包。请把项目拷到 Mac 后再运行。"
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。请先安装 Node.js，再运行这个文件。"
  exit 1
fi

if [[ ! -d node_modules/electron-builder ]]; then
  echo "正在安装依赖..."
  npm install || exit 1
fi

echo "正在打包 Mac 版本。第一次可能要几分钟。"
npm run dist:mac || exit 1

echo
echo "安装包在 release 文件夹："
echo "RouteEditor-1.0.0-mac.dmg"
echo "RouteEditor-1.0.0-mac.zip"
