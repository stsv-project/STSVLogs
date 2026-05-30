# SPEC.md — STSVLogs 项目规范

## 项目定位

STSVLogs 是 STSVWB 模组的遥测数据接收与可视化服务，同时提供模组更新清单下发。

- 遥测上报入口：`POST /ingest`
- 更新清单入口：`GET /update-manifest.json`
- 仪表盘入口：`/`（前端 SPA）
- 诊断面板入口：`/diagnostics`
- 对局分析入口：`/runs`

## 架构规则

### 分层约束

```
cmd/server/main.go          — 组装层：注册路由、初始化依赖
internal/handler/*.go       — HTTP 层：参数解析、响应序列化、状态码
internal/store/postgres.go  — 数据层：所有 SQL 查询集中在此文件
internal/model/*.go         — 模型层：数据结构定义
```

- **Handler 不得包含 SQL 字符串**。所有数据库访问通过 `store.Store` 的方法完成。
- **Store 不得引用 `net/http`**。数据层只依赖 `context.Context` 和数据库驱动。
- **路由注册统一在 `cmd/server/main.go`**，不分散到各包。
- **新功能应先扩展 Store 方法，再写 Handler，最后注册路由**。

### 错误处理

- Store 方法返回 `(result, error)`，error 由调用方处理。
- Handler 中数据库错误统一返回 HTTP 500，参数错误返回 400。
- 不要在 Handler 中 `panic`。

### 日志

- 使用标准库 `log`，不引入第三方日志库。
- 数据库连接失败使用 `log.Fatal` 终止进程。

## API 规范

### 端点列表

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/healthz` | 健康检查 |
| POST | `/ingest` | 遥测事件上报 |
| GET | `/api/stats/overview` | 总览统计（含 9 维分布） |
| GET | `/api/stats/trends?days=N` | 每日事件趋势 |
| GET | `/api/stats/diagnostics` | 诊断面板数据 |
| GET | `/api/stats/diagnostics/trends?days=N` | 每日异常趋势 |
| GET | `/api/stats/runs` | 对局分析数据 |
| GET | `/api/stats/runs/trends?days=N` | 每日对局趋势 |
| GET | `/api/events` | 分页事件查询 |
| GET | `/api/config/version` | 版本信息 |
| PUT | `/api/config/version` | 更新版本（需认证） |
| GET | `/update-manifest.json` | 模组更新清单 |
| POST | `/api/auth/login` | 管理员登录 |

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

### JSONB 查询

- JSONB 字段取值使用 `->>` 操作符，返回 text 类型。
- **聚合查询必须处理 NULL**：`groupCount()` 辅助方法使用 `*string` 扫描，NULL 映射为 `"(unknown)"`。
- 不要假设 JSONB 字段一定存在；历史事件可能缺少某些 key。
- **JSONB 数组查询**：使用 `jsonb_array_elements()` 解包 JSON 数组，使用 `unnest(string_to_array())` 拆解分隔字符串。
- **多值字段统计**：`run_character_ids` 是空格分隔的字符串列表，使用 `unnest(string_to_array(properties->>'run_character_ids', ' '))` 拆解为多行后聚合。

## 前端规范

### 技术约束

- React 函数组件 + Hooks，不使用 Class 组件。
- 数据获取统一使用 TanStack React Query 的 `useQuery`。
- API 调用统一通过 `src/api.ts` 的 `get<T>()` 函数。
- 类型定义集中在 `src/types.ts`。

### 页面组织

- 页面组件放在 `src/pages/`，一个文件一个页面。
- 路由和导航在 `src/App.tsx` 中集中定义。
- 导航栏使用 `Nav` 组件，通过 `useLocation` 高亮当前页。
- 不使用 CSS Modules 或 styled-components，使用内联 style 或全局 CSS。
- 导航项顺序：概览 → 诊断 → 对局 → 管理。

### 图表

- 使用 Recharts 库，不引入其他图表库。
- 图表颜色使用 `COLORS` 常量数组统一管理。
- 图表区块使用 `ChartSection` 私有组件包裹（标题 + ResponsiveContainer）。
- 指标卡片使用 `MetricCard` 私有组件（灰色圆角卡片，支持 `color` 属性）。
- **角色使用率图表**：横向堆叠柱状图，蓝色=出场次数，绿色=胜利，Tooltip 显示默认信息。

### 数据转换

- `Record<string, number>` 到图表数据使用 `mapToChartData()` 转换。
- 排行数据使用 `sortedChartData()` 先排序再转换。
- 角色/异常类型排行取 TOP 15，避免图表过长。

## 部署规范

### 构建

- 后端：`go build -o server ./cmd/server`
- 前端：`cd web && npm run build`，产物在 `web/dist/`

### 环境变量

- `DATABASE_URL`：PostgreSQL 连接字符串（必需）
- `ADMIN_PASSWORD`：管理员密码（必需）

### 端口

- 服务监听 `:2666`，硬编码在 `main.go`。

## 遥测数据模型

### 事件类别

| 类别 | 事件名 | 字段要点 |
|---|---|---|
| BasicUsage | session_start | 会话快照，含所有公共字段 |
| ModInventory | mod_inventory | payload.mods[] 含完整模组列表 |
| Diagnostics | exception | exception_type, capture_source |
| RunHistory | run_history.completed | run_character_ids(空格分隔), is_victory, run_floor_reached, run_ascension, run_game_mode |

### Properties 公共字段

所有事件均包含：`anonymous_install_id`、`session_id`、`game_version`、`game_language`、`os_name`、`platform`、`process_architecture`、`ritsulib_version`、`dotnet_runtime`。

### RunHistory 特有字段

`run_character_ids`（空格分隔多角色）、`is_victory`、`is_abandoned`、`run_floor_reached`、`run_ascension`、`run_time_seconds`、`run_game_mode`。

## 变更规则

- **修改 Store 后必须 `go build ./...` 验证编译通过**。
- SQL 字符串中的单引号在 Go 反引号字符串中直接书写，不转义。
- 新增聚合查询时，优先扩展现有端点而非新建端点。
- 前端新增图表时，确保 Recharts 支持该图表类型。
- 数据库迁移不可回退已应用的变更，只能追加新迁移。
- **不要删除或修改已部署的迁移文件**。
- 修改 API 响应结构时，同步更新 `web/src/types.ts`。
- JSONB 聚合查询使用 `groupCount()` 而非手写 Scan 循环，确保 NULL 安全。
- 角色 ID 清洗：Store 层用 SQL `regexp_replace` 去前缀后缀，Go 层用 `strings.Replace` 去 `STSVWB_CHARACTER_` 前缀。
