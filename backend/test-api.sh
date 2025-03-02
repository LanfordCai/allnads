#!/bin/bash

# 显示文字样式
BOLD='\033[1m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BOLD}${BLUE}=== WenAI MCP API 测试工具 ===${NC}\n"

# 获取测试类型参数
TEST_TYPE=$1

# 如果未指定测试类型，显示帮助并退出
if [ -z "$TEST_TYPE" ]; then
  echo -e "${YELLOW}使用方法:${NC}"
  echo -e "  ${BOLD}./test-api.sh <测试类型>${NC}"
  echo -e "\n${YELLOW}可用测试类型:${NC}"
  echo -e "  ${BOLD}integration${NC} - 运行服务层集成测试"
  echo -e "  ${BOLD}interactive${NC} - 运行交互式API测试"
  echo -e "  ${BOLD}api-routes${NC} - 运行API路由测试"
  echo
  exit 1
fi

# 检查环境变量
if [ ! -f .env ]; then
  echo -e "${YELLOW}未找到.env文件，创建一个示例文件...${NC}"
  echo "OPENROUTER_MODEL=anthropic/claude-3.5-sonnet" > .env
  echo "MCP_SERVER_URL=http://localhost:8080/sse" >> .env
  echo "MCP_SERVER_NAME=evm_tool" >> .env
  echo "API_BASE_URL=http://localhost:3000/api" >> .env
  echo "SERVICE_API_KEY=test-api-key" >> .env
  echo -e "${GREEN}已创建.env文件，请根据需要修改配置${NC}\n"
fi

# 执行不同的测试
case $TEST_TYPE in
  integration)
    echo -e "${YELLOW}运行服务层集成测试...${NC}\n"
    npx tsx src/tests/integration.test.ts
    ;;
  interactive)
    echo -e "${YELLOW}运行交互式API测试...${NC}\n"
    npx tsx src/scripts/api-test.ts
    ;;
  api-routes)
    echo -e "${YELLOW}运行API路由测试...${NC}\n"
    # 检查axios依赖
    if ! grep -q "axios" package.json; then
      echo -e "${YELLOW}安装缺少的依赖: axios...${NC}"
      npm install --save axios
    fi
    npx tsx src/tests/api-routes.test.ts
    ;;
  *)
    echo -e "${RED}错误: 未知的测试类型 '$TEST_TYPE'${NC}\n"
    echo -e "请使用 ${BOLD}integration${NC}, ${BOLD}interactive${NC} 或 ${BOLD}api-routes${NC}\n"
    exit 1
    ;;
esac 