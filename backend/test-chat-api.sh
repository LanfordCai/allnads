#!/bin/bash

# 定义 API 基础 URL
API_URL="http://localhost:3000/api"

# 测试健康检查 API
echo "测试健康检查 API..."
curl -s "${API_URL}/health" | jq .

echo ""
echo "创建一个新的聊天会话..."
SESSION_RESPONSE=$(curl -s -X POST "${API_URL}/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "你好，请介绍一下你自己"
  }')

echo $SESSION_RESPONSE | jq .

# 提取会话 ID
SESSION_ID=$(echo $SESSION_RESPONSE | jq -r '.data.sessionId')

echo ""
echo "获取所有会话..."
curl -s "${API_URL}/chat/sessions" | jq .

echo ""
echo "获取会话 $SESSION_ID 的历史记录..."
curl -s "${API_URL}/chat/sessions/${SESSION_ID}" | jq .

echo ""
echo "继续与会话 $SESSION_ID 对话..."
curl -s -X POST "${API_URL}/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "'"${SESSION_ID}"'",
    "message": "你能告诉我更多关于 TypeScript 的信息吗？"
  }' | jq .

echo ""
echo "获取更新后的会话历史..."
curl -s "${API_URL}/chat/sessions/${SESSION_ID}" | jq .

echo ""
echo "删除会话 $SESSION_ID..."
curl -s -X DELETE "${API_URL}/chat/sessions/${SESSION_ID}" | jq .

echo ""
echo "尝试获取已删除的会话（应该返回 404）..."
curl -s "${API_URL}/chat/sessions/${SESSION_ID}" | jq . 