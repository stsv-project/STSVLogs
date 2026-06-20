# STSVLogs

STSVWB（塔之诗·超凡世界）模组的遥测后端服务 — 接收游戏遥测事件，提供仪表盘可视化，并负责模组更新清单的动态下发。


**部署地址**: [stsvlogs.hypd.asia](https://stsvlogs.hypd.asia)

## 功能

- **遥测上报** — 接收游戏客户端发送的遥测事件（BasicUsage、ModInventory、Diagnostics、RunHistory）
- **仪表盘** — 事件概览、每日趋势、诊断面板、对局分析
- **更新清单** — 动态下发 `update-manifest.json`，供模组检查更新
- **管理后台** — Bearer Token 认证的管理页面，配置版本信息

## 技术栈

| 层     | 技术                                                                       |
| ------ | -------------------------------------------------------------------------- |
| 后端   | Go 1.26 + chi + pgx/v5                                                     |
| 前端   | TypeScript + React 19 + React Router 7 + TanStack React Query 5 + Recharts |
| 数据库 | PostgreSQL                                                                 |
| 构建   | Vite + Rolldown（前端），`go build`（后端）                              |

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
  src/pages/Runs.tsx         — 对局分析
  src/pages/Admin.tsx        — 管理页
  src/api.ts                 — API 封装
  src/types.ts               — 前端类型定义
```

## 本地运行

### 前置条件

- Go 1.26+
- Node.js 20+
- PostgreSQL 运行中

### 步骤

1. 创建数据库并设置环境变量：

```bash
# .env
DATABASE_URL=postgres://user:password@localhost:5432/stsvlogs
ADMIN_PASSWORD=your-admin-password
```

2. 执行迁移：

```bash
psql $DATABASE_URL < migrations/001_init.sql
psql $DATABASE_URL < migrations/002_config.sql
```

3. 启动后端：

```bash
go run ./cmd/server
```

服务监听 `:2666`。

4. 启动前端开发服务器：

```bash
cd web && npm install && npm run dev
```

### 构建部署

```bash
# 后端
go build -o server ./cmd/server

# 前端
cd web && npm run build
```

前端构建产物输出到 `web/dist/`，由后端静态文件服务托管。

## API 端点

| 端点                                  | 说明                                         |
| ------------------------------------- | -------------------------------------------- |
| `GET /update-manifest.json`         | 模组更新清单                                 |
| `POST /ingest`                      | 遥测上报                                     |
| `GET /api/stats/overview`           | 总览：事件统计 + 9 维分布                    |
| `GET /api/stats/trends`             | 每日事件趋势（`?days=` 默认 30，上限 365） |
| `GET /api/stats/diagnostics`        | 诊断：异常类型/来源/版本分布                 |
| `GET /api/stats/diagnostics/trends` | 每日异常趋势                                 |
| `GET /api/stats/runs`               | 对局：角色使用率/胜率/楼层/进阶/模式         |
| `GET /api/stats/runs/trends`        | 每日对局趋势                                 |
| `GET /api/events`                   | 分页原始事件（`?page=&limit=`）            |
| `GET /api/config/version`           | 版本配置                                     |
| `POST /api/auth/login`              | 管理登录（需要 Bearer Token）                |

管理端点需要 `Authorization: Bearer <token>`。

## 遥测事件类型

遥测数据格式由 [STSVWB 模组](https://github.com/stsv-project/STSVWB) 和 [RitsuLib](https://github.com/BAKAOLC/RitsuLib) 框架定义。

| 事件             | 说明                                     |
| ---------------- | ---------------------------------------- |
| `BasicUsage`   | 基础使用数据（启动次数、游戏时长等）     |
| `ModInventory` | 模组存量（启用模组列表）                 |
| `Diagnostics`  | 诊断事件（异常类型、来源、版本）         |
| `RunHistory`   | 对局记录（角色、胜败、楼层、进阶、模式） |

### 对局结果模型

- `is_victory = true` → 胜利
- `is_abandoned = true` → 放弃（中途退出）
- 两者均为 false → 失败
- 胜率 = 胜利 / 有效对局（有效对局 = 总场次 - 放弃）

## 关联仓库

- [STSVWB](https://github.com/stsv-project/STSVWB) — 模组源码，遥测事件定义方
- [RitsuLib](https://github.com/BAKAOLC/STS2-RitsuLib) — 模组框架，遥测采集逻辑

## License

MIT
