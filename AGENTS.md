# AGENTS.md — STSVLogs

## 项目简介

STSVLogs 是 STSVWB（塔之诗·超凡世界）模组的遥测后端服务，负责接收游戏遥测事件并提供仪表盘可视化。同时兼任模组更新清单（`update-manifest.json`）的动态下发。

- **部署地址**: https://stsvlogs.hypd.asia
- **服务端口**: `:2666`
- **语言**: Go 1.26（后端）、TypeScript + React（前端）

## 项目结构

```
cmd/server/main.go          — 入口，组装路由
internal/
  model/telemetry.go         — 数据模型
  store/postgres.go          — 数据访问层（所有 SQL 集中在这里）
  ingest/handler.go          — POST /ingest
  query/handler.go           — GET /api/stats/*, /api/events
  config/handler.go          — 版本清单管理
  auth/handler.go            — Bearer Token 认证
migrations/                  — DDL 迁移脚本
web/                         — Vite + React + TypeScript 前端
  src/App.tsx                — 路由 + 导航
  src/pages/Overview.tsx     — 仪表盘概览
  src/pages/Diagnostics.tsx  — 诊断面板
  src/pages/Admin.tsx        — 管理页
  src/api.ts                 — API 封装
  src/types.ts               — 前端类型定义
```

## 开发约定

### 后端

- **路由框架**: `go-chi/chi`，所有路由注册在 `cmd/server/main.go`
- **数据库**: PostgreSQL，通过 `pgx/v5` 连接池访问
- **所有 SQL 必须写在 `internal/store/postgres.go`**，handler 只做 HTTP 层面的参数解析和响应序列化
- 新增查询方法遵循 `func (s *Store) MethodName(ctx context.Context, params...) (result, error)` 签名
- 聚合查询返回 `map[string]interface{}` 或命名 struct，JSON 序列化由 handler 完成
- 环境变量通过 `godotenv.Load()` 加载 `.env` 文件
- 错误处理：数据库错误直接返回，handler 层统一 `http.Error(w, err.Error(), 500)`
- 日志使用标准库 `log` 包
- **GROUP BY 聚合使用 `groupCount()` 辅助方法**，该方法已处理 NULL 值（映射为 `"(unknown)"`）
- **pgx 扫描 NULL 到 Go string 会报错**，聚合查询必须使用 `*string` 指针或 `COALESCE`

### 前端

- 构建工具: Vite + Rolldown
- UI 库: React 19 + React Router 7 + TanStack React Query 5
- 图表: Recharts（LineChart、BarChart、PieChart）
- API 调用统一通过 `src/api.ts` 的 `get<T>()` 泛型函数
- 类型定义集中在 `src/types.ts`
- 页面组件放在 `src/pages/`，一个文件一个页面
- 不引入额外的 CSS 框架，使用内联 style
- **导航栏**: 在 `App.tsx` 中通过 `Nav` 组件统一管理，使用 `useLocation` 高亮当前页
- **通用组件**: `MetricCard`（指标卡片）和 `ChartSection`（图表区块）在页面内定义为私有组件
- **图表数据转换**: 使用 `mapToChartData()` 将 `Record<string,number>` 转为 `{name,value}[]`

### API 设计

- RESTful 风格，JSON 请求/响应
- 分页参数: `page`（从 1 开始）、`limit`（默认 20，最大 100）
- 认证: Bearer Token，通过 `Authorization` header 传递
- 管理端点需要 `auth.Middleware` 包裹
- 时间序列端点使用 `?days=` 参数（默认 30，上限 365）

## 本地运行

1. 确保 PostgreSQL 运行中，创建数据库
2. 设置环境变量 `DATABASE_URL` 和 `ADMIN_PASSWORD`（可写入 `.env`）
3. 执行迁移: `psql $DATABASE_URL < migrations/001_init.sql && psql $DATABASE_URL < migrations/002_config.sql`
4. 启动后端: `go run ./cmd/server`
5. 启动前端: `cd web && npm run dev`

## 构建部署

```bash
# 后端
go build -o server ./cmd/server

# 前端
cd web && npm run build
```

前端构建产物输出到 `web/dist/`，由 Go 服务静态托管或反向代理提供。

## 注意事项

- `server.exe` 是预编译的 Windows 二进制，不要提交到 git（已在 `.gitignore`）
- 去重逻辑在数据库层面通过唯一索引实现，不要在应用层重复
- 修改 `internal/store/postgres.go` 的查询后，务必 `go build ./...` 验证编译通过
- JSONB 字段查询使用 `->>` 操作符，结合 `groupCount()` 处理可能的 NULL 值
- Recharts 的 `ResponsiveContainer` 需要父容器有明确宽度，图表区块使用 `flex: "1 1 400px"` + `minWidth: 320`
