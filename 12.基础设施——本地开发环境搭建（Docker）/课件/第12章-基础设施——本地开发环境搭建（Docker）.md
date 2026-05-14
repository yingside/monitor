# 第 12 章：基础设施——本地开发环境搭建（Docker）

---

## 本章概要

| 项目 | 说明 |
|---|---|
| **核心目标** | 用 Docker Desktop + Docker Compose 一键启动本地基础设施 |
| **交付物** | `docker/docker-compose.yml` + `docker/.env`，四个容器跑通 |
| **重点** | 理解每个服务的用途，搞清楚谁放 Docker 谁在本机跑 |
| **难点** | Kafka KRaft 模式的 Listener 配置（容器内 vs 宿主机两条路径） |
| **涉及技术** | Docker Desktop / Docker Compose / Kafka / ClickHouse / PostgreSQL |

> ⚠️ **课程深度说明**
>
> 本章 Docker 仅做开发环境工具使用，重点是"会用"。不涉及：Docker 网络模型、镜像制作（Dockerfile）、容器安全、多阶段构建。这些在第 23 章部署时才会涉及，且仍以"够用"为标准。

---

## 12.1 开讲之前：先把全局想清楚

**这一节先把所有问题一次性回答完：我们需要哪些基础设施？各是干什么的？为什么要用它？不用行不行？**

> 前端同学学到这里通常会有几个大问号：
> - "为什么要用 Docker？直接在本机装不行吗？"
> - "为什么要用 Kafka？SDK 上报直接写数据库不行吗？"
> - "为什么要两个数据库？PostgreSQL 不够用吗？"
>
> 把这些问号先清空，后面的操作才能理解。

---

### 我们总共需要启动哪些东西？

本章结束后，本地将跑起来 **4 个基础设施容器**，加上你在本机用 `pnpm dev` 跑的后端。整体如下：

```
┌───────────────────────────────────────────────────────────────┐
│  你的笔记本                                                     │
│                                                               │
│  本机进程（pnpm dev 运行，代码热更新）                           │
│  ┌────────────────────┐   ┌────────────────────┐             │
│  │  dsn-server        │   │  monitor-server     │             │
│  │  NestJS（第14章）   │   │  NestJS（第16章）   │             │
│  └────────┬───────────┘   └──────────┬─────────┘             │
│           │ 写消息                    │ 查数据                  │
│  ─────────┼──────────────────────────┼────────────────────── │
│  Docker 容器（基础设施，几乎不改动）                             │
│  ┌──────────┐ ┌─────────┐ ┌──────────────┐ ┌─────────────┐  │
│  │  Kafka   │ │Kafka UI │ │  ClickHouse  │ │ PostgreSQL  │  │
│  │  :9094   │ │  :8081  │ │    :8123     │ │    :5432    │  │
│  └──────────┘ └─────────┘ └──────────────┘ └─────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

四个容器，各自负责一件事，缺一不可。下面逐个回答"为什么要用它"。

---

### 问题一：为什么用 Docker？直接在本机装不行吗？

> 直接在本机装，**技术上完全可以**。但有几个实际问题：

**1. 多个服务版本冲突**

Kafka、ClickHouse、PostgreSQL 各有依赖，直接装到本机容易互相冲突。比如 PostgreSQL 升级 libssl 版本，可能破坏其他服务。

**2. 一台电脑跑多个项目**

你下一个项目可能也用 PostgreSQL，但要的是不同版本。Docker 可以让每个项目隔离用自己的版本，互不干扰。

**3. 安装过程因人而异**

Kafka 在 macOS、Windows、Linux 上的安装方式不一样，配置繁琐，同学互相对齐环境耗时。

**4. Docker 的核心价值：一致性**

> 📖 **术语：容器化（Containerization）**
>
> 白话：把软件和它需要的所有运行环境打包成一个"盒子"，不管在谁的电脑上运行，行为都一样。
>
> `docker compose up` 一条命令，所有人的环境完全一致，不存在"我这里能跑，你那里不行"的问题。

**总结**：不是"必须用 Docker"，而是"用了之后省很多麻烦"。课程中 Docker 只是工具，重点是这四个服务本身在做什么。

---

### 问题二：为什么要 Kafka？SDK 上报直接写数据库不行吗？

这是前端同学最常问的问题，也是整个架构里最值得讲清楚的一个决策。

**先说"直接写"的方案长什么样：**

```
SDK 上报
  → DSN 服务（NestJS）
  → 直接写 ClickHouse
```

这个方案**在流量小的时候完全没问题**。但监控系统有一个典型特点：**流量不均匀**。

```
平时：100 条/秒   ClickHouse 游刃有余
促销高峰：5000 条/秒
         ↓
         ClickHouse 写入堆积
         ↓
         DSN 服务等待超时
         ↓
         SDK 上报失败 → 监控数据丢失
         ↓
         高峰期偏偏是最需要监控数据的时候 😱
```

**Kafka 插进来之后：**

```
SDK 上报
  → DSN 服务（NestJS）→ Kafka（极快，几乎不等待）→ 立刻返回 200 OK
                              ↓
                         Consumer 服务（按自己节奏从 Kafka 取消息）
                              ↓
                         ClickHouse（稳定写入，不被冲垮）
```

> 📖 **术语：消息队列（Message Queue）**
>
> 白话：就像饭店的"叫号系统"。顾客（SDK 上报）拿到号就走，不用站着等厨房出餐（数据库写入）。厨房按自己的节奏出餐，再多的顾客也不会让厨房崩溃。
>
> 核心作用：**解耦 + 削峰填谷**。生产者（DSN 服务）和消费者（数据库写入服务）各自按自己的速度运行，互不阻塞。

**不用 Kafka 行不行？**

对于课程演示环境完全没问题。但真实的监控系统上了生产，高峰期不加 Kafka 保护，数据库分分钟被打挂，这时候偏偏又是最需要监控数据的时刻——这就是监控系统的悖论：最需要它的时候，最容易崩。

> 🏗️ **架构思考**
>
> 除了削峰，Kafka 还带来另一个好处：**数据可以被多个 Consumer 消费**。
>
> 比如未来你想同时做：① 写入 ClickHouse 实时存储，② 触发实时告警（发钉钉消息），③ 写入数据仓库做离线分析。
>
> 这三件事可以同时订阅同一个 Kafka Topic，互不干扰。如果直接写数据库，每加一个需求都要改 DSN 服务的代码。

---

### 问题三：为什么要两个数据库？PostgreSQL 不够吗？

"一个数据库解决所有问题"的想法很自然，但背后有一个关键差异：**两种数据的读写模式完全不同**。

**PostgreSQL 处理的业务数据：**

| 场景 | 操作 |
|---|---|
| 用户登录 | 查一条 WHERE email = ? |
| 创建项目 | INSERT 一条，立刻拿到 ID |
| 修改项目名 | UPDATE 一条 |

特点：**操作少量行，要求事务、一致性、精确匹配**。这是传统关系型数据库的强项。

**ClickHouse 处理的监控数据：**

| 场景 | 操作 |
|---|---|
| 过去 7 天每小时错误数趋势 | 扫描数百万行，GROUP BY 时间段 |
| 影响用户最多的错误 TOP 10 | 对 user_id 去重 COUNT |
| 某个页面的平均加载时间 | AVG(duration) WHERE page = ? |

特点：**写入量极大，查询需要扫描大量行、做聚合统计**。

> 📖 **术语：OLTP vs OLAP**
>
> 白话：
> - **OLTP（事务型）**：处理日常业务"一条一条"的增删改查。PostgreSQL 擅长。
> - **OLAP（分析型）**：对海量历史数据做聚合统计出报表。ClickHouse 擅长。

> 📖 **术语：行式存储 vs 列式存储**
>
> 白话：
> - **行式存储（PostgreSQL）**：一条记录的所有字段连续存在磁盘上。
>   查"某个用户"快，但统计"所有记录的某一列"时，要把不相关的字段也从磁盘读出来，浪费 IO。
> - **列式存储（ClickHouse）**：同一列的数据连续存在磁盘上。
>   统计"所有记录的 duration 列"时，只读 duration 列，其他列完全不碰，IO 极小，聚合快几十倍。

**用 PostgreSQL 存监控日志行不行？**

技术上可以，但扛不住量。一天 100 万条错误日志，累积一个月就是 3 亿行。用 PostgreSQL 查"过去 24 小时的错误趋势"要扫几千万行，查询可能要几十秒。ClickHouse 的同一查询通常在毫秒到秒内完成。

**两者分工总结：**

| 数据库 | 存什么 | 为什么 |
|---|---|---|
| PostgreSQL | 用户表、项目表（业务数据） | 需要事务、外键、精确查询 |
| ClickHouse | 错误日志、性能日志、行为日志、API 日志（监控数据） | 需要高速写入 + 大量聚合分析 |

---

### 问题四：Kafka UI 是什么？必须要吗？

Kafka UI 是一个可视化管理界面，让你在浏览器里看到：
- 有哪些 Topic（消息频道）
- 每个 Topic 里有多少消息
- 消费者消费到哪了

**不是必须的，但是非常有用。** 后续调试时，如果发现数据没写进 ClickHouse，第一步就是看 Kafka UI——消息是否进了 Topic？如果进了，就说明问题在 Consumer 那边。如果没进，问题在 DSN 服务那边。

---

### 全局总结：为什么这样分工？

```
┌─────────────────────────────────────────────────────────────────┐
│                       核心设计原则                               │
│                                                                 │
│  DSN 服务（接收）→ Kafka（缓冲）→ Consumer（消费）→ ClickHouse  │
│                                                                 │
│  1. 接收和存储解耦：DSN 不直接依赖 ClickHouse，高峰写不崩         │
│  2. 业务数据和分析数据分库：PostgreSQL 管用户，ClickHouse 管日志  │
│  3. 基础设施容器化：一条命令启动，环境一致，随时可销毁重建         │
└─────────────────────────────────────────────────────────────────┘
```

**把这张图看懂，后面的所有配置操作都只是在把它变成现实。**

---

## 12.2 Docker 核心概念（三分钟搞定）

安装好 Docker Desktop 后，只需要理解三个概念：

> 📖 **术语：镜像（Image）**
>
> 白话：软件的"安装包"，里面打包了程序运行所需的一切。是只读的，不能直接修改。

> 📖 **术语：容器（Container）**
>
> 白话：基于镜像"开机"运行的实例。镜像是模板，容器是实例——一个镜像可以开多个容器。

> 📖 **术语：Volume（数据卷）**
>
> 白话：容器默认关掉就丢数据。Volume 把数据存在宿主机上，容器重启后数据仍在。

**安装方式：**

- 官网下载：[https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
- macOS 安装 `.dmg`，Windows 用 WSL2 后端
- 安装后验证：`docker --version` 和 `docker compose version`

---

## 12.3 编写 docker/docker-compose.yml

### 文件位置

```
monitor/
└── docker/
    ├── docker-compose.yml   ← 容器编排定义（提交 Git）
    ├── .env                 ← 本地实际配置（不提交 Git）
    └── .env.example         ← 配置模板（提交 Git）
```

> 🏗️ **架构思考**
>
> 为什么放在 `docker/` 目录而不是根目录？
>
> 根目录会越来越多文件（`turbo.json` / `pnpm-workspace.yaml` 等），把 Docker 文件归到专属目录保持整洁。第 23 章在同一文件里追加应用服务时，也更好管理。

### 四个服务配置

完整 `docker-compose.yml` 见代码：`docker/docker-compose.yml`

**各服务要点：**

**PostgreSQL**
```yaml
image: postgres:16-alpine
ports: ["5432:5432"]
environment:
  POSTGRES_DB: monitor
  POSTGRES_USER: monitor
  POSTGRES_PASSWORD: Monitor2024    # 来自 .env
```

**ClickHouse**
```yaml
image: clickhouse/clickhouse-server:24.3-alpine
ports:
  - "8123:8123"   # HTTP Interface（DataGrip 和 @clickhouse/client 用这个）
  - "9000:9000"   # Native Interface（CLI 工具用，了解即可）
```

**Kafka（KRaft 模式）**

> 📖 **术语：KRaft 模式**
>
> 白话：老版 Kafka 需要额外启 Zookeeper 管理集群"通讯录"，KRaft 把这个功能内置了，少一个容器，配置更简单。

Kafka 的 Listener 配置是本章唯一的难点，因为它需要同时被**两种调用方**访问：

| 调用方 | 路径 | 地址 |
|---|---|---|
| 宿主机 NestJS 进程（本机 dev 运行） | Docker 网络外 | `localhost:9094` |
| 容器内 Consumer 服务（第 15 章） | Docker 网络内 | `kafka:9092` |

所以配置了两个 Listener：
```yaml
KAFKA_CFG_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093,EXTERNAL://:9094
KAFKA_CFG_ADVERTISED_LISTENERS=PLAINTEXT://kafka:9092,EXTERNAL://localhost:9094
```

> 🏗️ **架构思考**
>
> `ADVERTISED_LISTENERS` 的作用：Kafka 告诉客户端"你应该用哪个地址连我"。
> 容器内客户端拿到 `kafka:9092`，宿主机客户端拿到 `localhost:9094`，各走各的路。

**Kafka UI**
```yaml
image: provectuslabs/kafka-ui:v0.7.2
ports: ["8081:8080"]
depends_on:
  kafka:
    condition: service_healthy    # 等 Kafka 就绪后再启动
```

> 📖 **术语：healthcheck**
>
> 白话：Docker 定期探测容器是否真正就绪（不只是进程在跑）。`depends_on: condition: service_healthy` 确保依赖方启动顺序正确。

### Volume 持久化

```yaml
volumes:
  postgres_data:   name: monitor_postgres_data
  clickhouse_data: name: monitor_clickhouse_data
  kafka_data:      name: monitor_kafka_data
```

给 Volume 起固定 `name`：`docker volume ls` 一目了然，迁移备份方便。

---

## 12.4 封装启动命令

根目录 `package.json` 新增四条脚本：

```json
{
  "infra:start": "docker compose -f docker/docker-compose.yml --env-file docker/.env up -d",
  "infra:stop":  "docker compose -f docker/docker-compose.yml --env-file docker/.env stop",
  "infra:reset": "docker compose -f docker/docker-compose.yml --env-file docker/.env down -v",
  "infra:logs":  "docker compose -f docker/docker-compose.yml --env-file docker/.env logs -f"
}
```

| 命令 | 行为 | 数据 |
|---|---|---|
| `pnpm infra:start` | 后台启动所有容器 | 保留 |
| `pnpm infra:stop` | 停止容器（不删除） | 保留 |
| `pnpm infra:reset` | ⚠️ 停止 + 删除容器 + Volume | **清空** |
| `pnpm infra:logs` | 实时跟踪所有容器日志 | — |

> `--env-file docker/.env` 显式指定 env 路径，避免 Docker 默认从根目录找 `.env` 导致变量注入混乱。

---

## 12.5 启动验证

```bash
# 在项目根目录执行
pnpm infra:start

# 等待约 30 秒，查看状态
docker compose -f docker/docker-compose.yml ps
```

**预期输出：**

```
NAME                   STATUS
monitor-postgres       healthy
monitor-clickhouse     healthy
monitor-kafka          healthy
monitor-kafka-ui       running
```

Docker Desktop → Containers 面板，四个容器全部绿色。

---

## 12.6 DataGrip 连接验证

DataGrip 是 JetBrains 出品的数据库 IDE，同时支持 PostgreSQL 和 ClickHouse，本课程所有数据库操作统一用它演示。

### 连接 PostgreSQL

DataGrip → + → Data Source → PostgreSQL

| 参数 | 值 |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database | `monitor` |
| User | `monitor` |
| Password | `123456` |

点击 **Test Connection** → Succeeded → OK

### 连接 ClickHouse

DataGrip → + → Data Source → **ClickHouse (HTTP)**

| 参数 | 值 |
|---|---|
| Host | `localhost` |
| Port | `8123` |
| Database | `monitor` |
| User | `monitor` |
| Password | `123456` |

> ⚠️ Driver 选 `ClickHouse (HTTP)` 而非 `ClickHouse (Native)`，对应 8123 端口，与 `@clickhouse/client` 使用的同一接口。

### 验证 SQL

```sql
-- PostgreSQL
SELECT version();

-- ClickHouse
SELECT version();
```

### 验证 Kafka UI

浏览器打开 [http://localhost:8081](http://localhost:8081)，看到 `monitor-local` 集群，Broker 1 个节点即代表连通。

**Kafka UI 的详细介绍见 12.7 节**，在那里我们会逐一解释你在界面上看到的每一项是什么意思。

---

## 12.7 认识 Kafka UI——把 Kafka 的内部世界"看见"

刚打开 Kafka UI，界面上出现了一堆陌生词汇：`monitor-local`、Brokers、Topics、Consumer Groups……如果不解释，一脸懵很正常。这一节专门把这些词都翻译成人话。

### 打开 Kafka UI

浏览器访问：[http://localhost:8081](http://localhost:8081)

你会看到左侧导航栏，以及顶部显示一个集群名称：**monitor-local**。

---

### "monitor-local" 是什么？什么时候创建的？

> 📖 **术语：Kafka 集群（Cluster）**
>
> 白话：一个 Kafka 服务（或多台 Kafka 服务器组成的组）叫做一个"集群"。Kafka UI 可以同时管理多个集群，所以需要给每个集群起个名字。

`monitor-local` 这个名字是**我们在 `docker-compose.yml` 里配置的**：

```yaml
kafka-ui:
  environment:
    KAFKA_CLUSTERS_0_NAME: monitor-local          # ← 这里定义的名称
    KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092  # ← 告诉 Kafka UI 去哪连 Kafka
```

它只是一个显示用的标签，方便你在 UI 里区分"这是哪个 Kafka"。你可以改成任何名字，比如 `my-kafka`，对 Kafka 本身没有任何影响。

`kafka:9092` 是 Kafka UI 在 Docker 网络内部访问 Kafka 的地址，容器间互相访问用容器名（`kafka`）而不是 `localhost`。

---

### 左侧导航：四个核心概念

#### Brokers（代理节点）

> 📖 **术语：Broker**
>
> 白话：Kafka 服务器本身。你可以把 Broker 理解为"消息仓库"——存消息、分发消息都在这里。
>
> 生产环境为了高可用通常部署多个 Broker 组成集群。本课程开发环境只有 1 个 Broker，够用了。

点击 **Brokers**，你会看到：
- ID: `1`（我们在 docker-compose 里配置的 `KAFKA_NODE_ID: 1`）
- Host: `kafka:9092`（内部地址）
- 状态：Active

这就是我们那个 Kafka 容器。

---

#### Topics（话题/频道）

> 📖 **术语：Topic**
>
> 白话：Kafka 里的"消息分类频道"。不同类型的消息存在不同的 Topic 里，就像微信里的不同群组——技术群、家庭群、工作群各存各的消息。
>
> 生产者（Producer）往 Topic 里放消息，消费者（Consumer）从 Topic 里取消息。

**现在点 Topics，你看到的可能是空的，或者只有几个 `__consumer_offsets` 之类以双下划线开头的内部 Topic。**

这是正常的。因为我们还没有任何代码向 Kafka 发过消息，所以业务 Topic 还不存在。

我们在 `docker-compose.yml` 里配置了 `KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"`，这意味着：

> **Topic 不需要提前手动创建。当第一条消息发往某个 Topic 时，Kafka 会自动创建它。**

第 14 章启动 `dsn-server` 并发送第一条监控数据后，你会看到这些 Topic 自动出现：

| Topic 名称 | 存放的数据 |
|---|---|
| `monitor.error` | JS 错误、资源错误、Promise 异常、框架层错误 |
| `monitor.performance` | Core Web Vitals 等性能指标 |
| `monitor.behavior` | 页面访问、点击、路由跳转等用户行为 |
| `monitor.api` | XHR / Fetch 请求监控数据 |

点进一个 Topic 后，你还会看到 **Messages** 标签，里面能直接查看消息的原始内容（JSON 格式）。这在调试时非常有用：发了消息不确定有没有到 Kafka？点开看一眼就知道了。

---

#### Consumer Groups（消费者组）

> 📖 **术语：Consumer（消费者）/ Consumer Group（消费者组）**
>
> 白话：
> - **Consumer（消费者）**：从 Kafka Topic 里取消息并处理的程序。第 15 章我们写的 Kafka Consumer 就扮演这个角色，它从 Topic 里把监控事件取出来，写进 ClickHouse。
> - **Consumer Group（消费者组）**：一批做同一件事的 Consumer 的集合，用一个组名标识。Kafka 记录每个消费者组消费到了哪条消息（叫 Offset），这样 Consumer 重启后能从上次停下的地方继续，不会重复消费。

**现在 Consumer Groups 也是空的。** 因为第 15 章的 Consumer 还没实现。

第 15 章实现后，你会在这里看到一个消费者组，可以看到它的 **Lag（积压量）**：

> 📖 **术语：Consumer Lag（消费积压）**
>
> 白话：Topic 里还没被消费的消息数量。Lag = 0 说明消费跟上了生产；Lag 持续增大说明消费速度跟不上，需要扩容或优化。

---

### 一张图串联起来

```
你的浏览器
   ↓ 触发错误/行为
SDK（browser 包）
   ↓ POST /report（批量 JSON）
dsn-server（NestJS）             ← 第 14 章实现
   ↓ kafkajs Producer.send()
┌──────────────────────────────────┐
│  Kafka Broker（monitor-local）   │  ← 现在这里已经跑起来了
│  ├── Topic: monitor.error        │  ← 第 14 章第一次发消息后自动创建
│  ├── Topic: monitor.performance  │
│  ├── Topic: monitor.behavior     │
│  └── Topic: monitor.api         │
└──────────────────────────────────┘
   ↓ Consumer.subscribe()
Consumer 服务（NestJS）           ← 第 15 章实现
   ↓ INSERT
ClickHouse（monitor 库）          ← 第 13 章建表
```

**你在 Kafka UI 里能看到这条链路的中间层**：哪些 Topic 有消息、消息长什么样、Consumer 消费到哪了。这是调试数据链路最重要的窗口。

---

### 现在的状态：Kafka UI 里应该看到什么

| 导航项 | 当前状态 | 什么时候会有内容 |
|---|---|---|
| Brokers | ✅ 1 个 Broker（ID=1） | 已就绪 |
| Topics | 只有内部 Topic（`__consumer_offsets` 等）| 第 14 章第一次上报后自动创建业务 Topic |
| Consumer Groups | 空 | 第 15 章 Consumer 启动后出现 |

看到 Broker 在线，说明 Kafka 已经正常运行。Topic 为空是预期内的，别担心。



### 完成后的基础设施状态

| 服务 | 端口 | 用途 | 状态 |
|---|---|---|---|
| PostgreSQL | 5432 | 业务数据（用户/项目） | ✅ 运行中 |
| ClickHouse | 8123 / 9000 | 监控数据分析 | ✅ 运行中 |
| Kafka | 9094 | 消息队列 | ✅ 运行中 |
| Kafka UI | 8081 | Kafka 可视化 | ✅ 运行中 |

### 数据流当前进展

```
SDK（浏览器）
  ↓
collect-server（第 11 章临时，端口 3001）
  ↓ 第 14 章替换为 dsn-server NestJS
  ↓
Kafka ← ✅ 已就绪
  ↓ 第 15 章实现
Consumer → ClickHouse ← ✅ 已就绪
monitor-server API（第 16 章）← ✅ PostgreSQL 已就绪
```

**下一章（第 13 章）**：在已连通的 ClickHouse 里设计并创建四张监控数据表，为第 14 章写入数据做好准备。

---

## 附录：常见问题排查

### Q: pnpm infra:start 报错 "docker compose command not found"

更新 Docker Desktop 到最新版（Docker Compose V2 已内置），或把命令中的 `docker compose` 改为 `docker-compose`。

### Q: Kafka 一直显示 unhealthy

Kafka 初始化需要 30-60 秒，healthcheck 期间会失败。等待约 1 分钟后再检查，或运行 `pnpm infra:logs` 确认真实错误。

### Q: ClickHouse 连接报错 "Authentication failed"

检查 `docker/.env` 中的密码，或运行：
```bash
docker exec monitor-clickhouse clickhouse-client \
  --user monitor --password 123456 --query "SELECT 1"
```

### Q: 端口被占用

修改 `docker/.env` 中对应的端口变量（如 `CLICKHOUSE_HTTP_PORT=8124`），重新 `pnpm infra:start`。

### Q: macOS Apple Silicon（M1/M2/M3）启动 ClickHouse 失败

在 `docker-compose.yml` 的 clickhouse 服务下添加 `platform: linux/amd64`，或使用 24.x 版本镜像（已支持 ARM64）。
