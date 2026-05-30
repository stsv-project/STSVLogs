# SPEC.md — STSVLogs 项目规范

## 项目定位

STSVLogs 是 STSVWB 模组的遥测数据接收与可视化服务，同时提供模组更新清单下发。

- 遥测上报入口：`POST /ingest`
- 更新清单入口：`GET /update-manifest.json`
- 仪表盘入口：`/`（前端 SPA）

## 架构规则

### 分层约束

```
cmd/server/main.go          — 组装层：注册路由、初始化依赖
internal/handler/*.go       — HTTP 层：参数解析、响应序列化、状态码
internal/store/postgres.go  — 数据层：所有 SQL 查询集中在此文件
internal/model/*.go         — 模型层：数据结构定义
```

- **Handler 不得包含 SQL 字符串**。所有数据库访问通过 `store.Store` 的方法完成。
- **Store 不得引用 `net/http`**。数据层只依赖 `context.Context` 和 `database/sql` 相关类型。
- **路由注册统一在 `cmd/server/main.go`**，不分散到各包。
- **新功能应先扩展 Store 方法，再写 Handler，最后注册路由**。

### 错误处理

- Store 方法返回 `(result, error)`，error 由调用方处理。
- Handler 中数据库错误统一返回 HTTP 500，参数错误返回 400。
- 不要在 Handler 中 `panic`。

### 日志

- 使用标准库 `log`，不引入第三方日志库。
- Ingest 成功/失败需打印统计行（已有格式：`收到 X 条事件, 成功写入 Y 条`）。
- 数据库连接失败使用 `log.Fatal` 终止进程。

## API 规范

### 路径命名

- 遥测和数据查询端点使用 `/api/` 前缀。
- 管理端点使用 `/api/admin/` 或通过 auth middleware 保护。
- 更新清单端点直接使用 `/update-manifest.json`（配合 RitsuLib 更新协议）。

### 分页

- 查询参数：`page`（从 1 开始）、`limit`（默认 20，上限 100）。
- 响应必须包含 `total`、`page`、`limit` 字段。

### 认证

- 管理员操作需要 Bearer Token。
- Token 通过 `POST /api/auth/login` 获取，密码校验环境变量 `ADMIN_PASSWORD`。
- Token 存储在内存 `sync.Map`，服务重启后失效。

### 响应格式

- 所有 API 响应为 `application/json`。
- 成功响应无需包裹层，直接返回数据对象。
- 错误响应使用 `http.Error` 写入纯文本。

## 数据库规范

### 表结构

- 主表 `events` 存储所有遥测事件，使用 JSONB 存储半结构化数据。
- 配置表 `config` 为简单 key-value 结构。
- 迁移脚本按序号命名，存放在 `migrations/` 目录。

### 索引

- 去重唯一索引：`(anonymous_install_id, session_id, timestamp_utc, event_name)`
- 查询索引：`(category, timestamp_utc DESC)`
- 按需添加表达式索引加速 JSONB 字段查询。

### 写入

- 使用 `INSERT ... ON CONFLICT DO NOTHING` 实现幂等写入。
- 批量写入时逐条插入，失败的事件跳过并记录日志。

## 前端规范

### 技术约束

- React 函数组件 + Hooks，不使用 Class 组件。
- 数据获取统一使用 TanStack React Query 的 `useQuery`。
- API 调用统一通过 `src/api.ts` 的 `get<T>()` 函数。
- 类型定义集中在 `src/types.ts`。

### 页面组织

- 页面组件放在 `src/pages/`，一个文件一个页面。
- 路由在 `src/App.tsx` 中集中定义。
- 不使用 CSS Modules 或 styled-components，使用内联 style 或全局 CSS。

### 图表

- 使用 Recharts 库，不引入其他图表库。
- 图表颜色使用 `COLORS` 常量数组统一管理。

## 部署规范

### 构建

- 后端：`go build -o server ./cmd/server`
- 前端：`cd web && npm run build`，产物在 `web/dist/`

### 环境变量

- `DATABASE_URL`：PostgreSQL 连接字符串（必需）
- `ADMIN_PASSWORD`：管理员密码（必需，用于 `/api/auth/login`）

### 端口

- 服务监听 `:2666`，硬编码在 `main.go`。

## 遥测数据模型

### 事件类别

| 类别 | 事件名 | 说明 |
|---|---|---|
| BasicUsage | session_start | 会话启动快照 |
| ModInventory | mod_inventory | 模组清单 |
| Diagnostics | exception | 异常报告 |
| RunHistory | run_history.completed | 对局结束记录 |

### Properties 公共字段

所有事件均包含：`anonymous_install_id`、`session_id`、`game_version`、`game_language`、`os_name`、`platform`、`process_architecture`、`ritsulib_version`。

## 变更规则

- **修改 Store 后必须 `go build ./...` 验证编译通过**。
- 新增聚合查询时，优先扩展现有端点而非新建端点（减少路由数量）。
- 前端新增图表时，确保 Recharts 支持该图表类型。
- 数据库迁移不可回退已应用的变更，只能追加新迁移。
- **不要删除或修改已部署的迁移文件**。
