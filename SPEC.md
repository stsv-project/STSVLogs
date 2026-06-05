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
- 不使用 CSS Modules、styled-components 或额外 CSS 框架；共享样式写在 `src/index.css`。
- 导航项顺序：概览 → 诊断 → 对局 → 模组 → 管理。
- 通用仪表盘组件放在 `src/components/`，页面优先复用共享组件，避免每页重复定义指标卡和图表容器。

### 视觉风格

STSVLogs 前端采用“极简主义 + 数据驱动 + 扁平化 + 新粗野主义”的分析仪表盘风格。

- 页面视觉重点必须是数字、趋势、排行和分布，不做营销式落地页、装饰插画或氛围背景。
- 整体使用深色主背景、浅色数据面板、黑色硬边框和高对比文字。
- 面板、按钮、输入框使用 `0-4px` 低圆角；禁止柔和阴影、渐变背景、圆润 pill 风格和装饰性光效。
- 布局应密集但清晰：使用明确网格、稳定间距和硬分隔线，避免卡片套卡片。
- 标题层级保持紧凑；数据数字可以加粗放大，但不得喧宾夺主。
- 色板保持有限且高对比：橙、绿、紫、蓝、红、黄。新增图表颜色必须进入统一主题常量。
- 页面在桌面和移动宽度下不得出现文本重叠、按钮文字溢出或横向页面溢出。
- Admin 页也必须遵循同一硬边框、高对比、扁平化风格，不能退回默认表单样式。

### 共享组件

- `PageShell`：统一页面标题、kicker、subtitle、内容宽度和页面节奏。
- `MetricCard` / `MetricGrid`：统一指标块样式，强调数值和标签，支持有限 accent 色。
- `ChartPanel` / `PanelGrid`：统一图表面板、标题、说明和固定图表高度，确保 Recharts 父容器有明确宽高。
- `StatusBlock`：统一加载、错误和空状态。
- 图表主题常量集中在 `src/components/chartTheme.ts`，包括颜色、坐标轴、网格、Tooltip 和基础数据转换。

### 图表

- 使用 Recharts 库，不引入其他图表库。
- 图表颜色、坐标轴、网格和 Tooltip 使用 `chartTheme.ts` 统一管理。
- 默认优先使用横向条形图和折线图；类别较多时优先横向条形图。
- 尽量减少饼图，除非类别很少且占比关系比排行更重要。
- 表格只在明细阅读不可替代时使用；分析页默认优先图表和指标卡。
- 卡牌选取率、卡牌胜率等排行分析不得使用 table，使用 Top N 横向排行条形图和 Tooltip 展示细节。
- `ResponsiveContainer` 的父容器必须有明确宽度和高度，避免 Recharts 尺寸警告。
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
