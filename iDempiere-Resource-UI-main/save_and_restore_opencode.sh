#!/bin/bash

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo "🔧 OpenCode 日誌保存 & 重啟腳本"
echo "================================"

# Step 1: 保存現有日誌
echo ""
echo "📦 Step 1: 保存現有容器的日誌..."

CONTAINER_ID=$(docker ps -q --filter "name=opencode-web" | head -1)

if [ -n "$CONTAINER_ID" ]; then
    echo "  找到運行中的容器: $CONTAINER_ID"
    mkdir -p ~/.local/share/opencode/
    echo "  複製日誌..."
    docker cp "$CONTAINER_ID:/root/.local/share/opencode/." ~/.local/share/opencode/ 2>/dev/null || echo "  ⚠️  容器內沒有日誌目錄（首次啟動）"
    echo "  ✅ 日誌已保存"
else
    echo "  ⚠️  opencode-web 容器未運行，跳過備份"
fi

# Step 2: 停止並移除舊容器
echo ""
echo "🛑 Step 2: 停止容器..."
docker compose down 2>/dev/null || true
echo "  ✅ 容器已停止"

# Step 3: 啟動新容器（自動掛載 volume）
echo ""
echo "🚀 Step 3: 啟動新容器（帶 volume）..."
docker compose up -d
echo "  ✅ 新容器已啟動"

# Step 4: 恢復日誌到新容器
echo ""
echo "📥 Step 4: 恢復日誌到新容器..."
sleep 2  # 等待容器完全啟動

NEW_CONTAINER_ID=$(docker ps -q --filter "name=opencode-web" | head -1)
if [ -d ~/.local/share/opencode/ ]; then
    docker cp ~/.local/share/opencode/. "$NEW_CONTAINER_ID:/root/.local/share/opencode/" 2>/dev/null || true
    echo "  ✅ 日誌已恢復"
else
    echo "  ⚠️  沒有備份日誌可恢復"
fi

# Step 5: 驗證
echo ""
echo "✅ 完成！"
echo "================================"
echo "📋 保存位置: ~/.local/share/opencode/"
echo "🔗 Volume 綁定: docker-compose.yml"
echo "📖 查看日誌: ls -lah ~/.local/share/opencode/"
