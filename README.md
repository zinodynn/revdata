# 数据集审核平台 (Review Dataset Platform)

## 架构预览

```mermaid
flowchart TB
    %% 定义泳道
    subgraph SUPERADMIN["超级管理员"]
        direction TB
        SA1[创建管理员账户]
        SA2[管理所有用户权限/角色]
        SA3[监控系统健康状态]
        SA4[查看全局统计报告]
    end

    subgraph ADMIN["Admin (管理员)"]
        direction TB
        A1[上传原始数据] --> A2[管理用户权限/密码重置]
        A2 --> A3[配置审核规则]
        A3 --> A4[管理文档库]
        A4 --> A5[导出审核结果]
        A5 --> A6[生成报告]
    end


    subgraph REVIEWER["Reviewer (审核员)"]
        direction TB
        R1[接收审核任务] --> R2{审核语料}
        R2 -->|确定| R3[直接通过/拒绝/编辑变更]
        R2 -->|不确定| R4[审核页面标记,审核结束可以选择批量选中语料,生成授权码授权他人审核]
        R4 --> R5[委托给Assignee]
        R3 --> R6[更新审核状态]
        R6 --> R7[查看任务统计]
    end

    subgraph ASSIGNEE["Assignee 被委托人\n(无独立账号或委派成员)"]
        direction TB
        AS1[接收授权码或带授权码链接] --> AS2[访问审核界面]
        AS2 --> AS3[审核委托语料]
        AS3 --> AS4[提交审核结果]
        AS4 -->|自动关联| R6
    end

    subgraph SYSTEM["系统核心"]
        direction TB
        S1[(原始数据池)]
        S2[(审核任务数据包或队列)]
        S3[(授权码管理)]
        S4[(审核数据库)]
        S5[(导出文件库)]

        S1 -.->|指派分配| S2
        S2 -->|任务分发| R1
        S3 -->|验证| AS2
        S4 -->|汇总| S5
        S2 -->|按标签自动分配| R1
        S2 -->|手动指定Reviewer| R1
    end

    %% 配置审核规则选项
    subgraph CONFIGURATION["配置审核规则"]
        direction TB
        CR1[设置审核标准（如准确性、完整性等）]
        CR2[定义标签体系（用于自动化分配）]
        CR3[配置审核流程（单次/多次审核）]
        CR4[设定时间限制]
        CR5[自定义通知和提醒]
    end

    %% 跨泳道交互
    SA1 -->|创建| ADMIN
    SA2 -->|管理| REVIEWER
    SA2 -->|管理| ASSIGNEE
    SA4 -->|查看| SYSTEM

    A1 -->|写入| S1
    A3 -->|设置规则| CR1
    A3 -->|设置规则| CR2
    A3 -->|设置规则| CR3
    A3 -->|设置规则| CR4
    A3 -->|设置规则| CR5
    A5 -->|提取| S4
    R4 -->|创建| S3
    AS4 -->|写入| S4
    R5 -->|分享| AS1
    S2 -->|任务通知| R1

    A4--->|提取|S5
    %% 样式定义
    classDef superadmin fill:#f0f7ff,stroke:#08c,stroke-width:2px;
    classDef admin fill:#e6f7ff,stroke:#1890ff,stroke-width:2px;
    classDef reviewer fill:#e6fffb,stroke:#13c2c2,stroke-width:2px;
    classDef assignee fill:#fff7e6,stroke:#fa8c16,stroke-width:2px;
    classDef system fill:#f9f0ff,stroke:#722ed1,stroke-width:2px;
    classDef data fill:#fff2e8,stroke:#ff7a45,stroke-width:1px,stroke-dasharray:5 5;

    class SUPERADMIN superadmin;
    class ADMIN admin;
    class REVIEWER reviewer;
    class ASSIGNEE assignee;
    class SYSTEM system;
    class CONFIGURATION data;
    class S1,S2,S3,S4,S5 data;

    %% 重要连接线样式
    linkStyle 10 stroke:#fa541c,stroke-width:2px;
    linkStyle 11 stroke:#fa541c,stroke-width:2px,stroke-dasharray:3;
    linkStyle 12 stroke:#13c2c2,stroke-width:2px;

```



## 快速开始

### 开发环境

#### 后端
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```
API文档: http://localhost:8000/docs

#### 前端
```bash
cd frontend
npm install
npm run dev
```
访问: http://localhost:3000

### Docker 部署
```bash
docker-compose up -d
```
访问: http://localhost

## 默认账户

首次使用需要通过 API 注册用户:
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "email": "admin@example.com", "password": "admin123", "role": "super_admin"}'
```

## 项目结构

```
revdata/
├── backend/                 # FastAPI 后端
│   ├── app/
│   │   ├── api/            # API 路由
│   │   ├── core/           # 核心配置
│   │   ├── models/         # 数据库模型
│   │   ├── schemas/        # Pydantic 模式
│   │   └── main.py         # 应用入口
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                # React 前端
│   ├── src/
│   │   ├── components/     # 组件
│   │   ├── pages/          # 页面
│   │   ├── services/       # API 服务
│   │   ├── stores/         # 状态管理
│   │   └── App.tsx
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml
```

## 功能特性

### MVP 阶段 ✅
- [x] 用户认证 (登录/注册/JWT)
- [x] 数据集上传 (JSONL/JSON/CSV/TSV)
- [x] 卡片式审核界面
- [x] QA 对话左右分栏展示
- [x] 差异对比显示 (红绿高亮)
- [x] 快捷键支持 (PgUp/PgDn/Ctrl+Enter等)
- [x] 基础任务分配

## 快捷键

| 快捷键           | 功能         |
| ---------------- | ------------ |
| PgUp             | 上一条语料   |
| PgDn             | 下一条语料   |
| Ctrl+Enter       | 通过并下一条 |
| Ctrl+Shift+Enter | 拒绝并下一条 |
| Ctrl+E           | 进入编辑模式 |
| Alt+S            | 保存修改     |
| Esc              | 取消编辑     |

## API 文档

启动后端后访问: http://localhost:8000/docs

---

## VS Code 开发调试

### 推荐插件

首次打开项目时,VS Code 会提示安装推荐插件,点击"全部安装"即可。

### 调试配置

按 `F5` 或点击"运行和调试"面板,选择以下配置:

| 配置名称          | 说明                                           |
| ----------------- | ---------------------------------------------- |
| **后端: FastAPI** | 启动后端服务器并开启断点调试                   |
| **前端: Chrome**  | 启动 Chrome 调试前端 (需先启动前端 dev server) |
| **前端: Edge**    | 启动 Edge 调试前端                             |
| **全栈调试**      | 同时启动后端 + Chrome 调试                     |

### 任务 (Tasks)

按 `Ctrl+Shift+B` 运行默认任务 (全栈启动)，或按 `Ctrl+Shift+P` 输入 "Run Task" 选择:

| 任务名称                 | 说明                            |
| ------------------------ | ------------------------------- |
| **全栈: 启动开发环境**   | 同时启动前后端开发服务器 (默认) |
| **后端: 启动开发服务器** | 仅启动 FastAPI                  |
| **前端: 启动开发服务器** | 仅启动 Vite                     |
| **Docker: 启动全部服务** | docker-compose up -d            |
| **Docker: 重建并启动**   | docker-compose up -d --build    |

### 开发环境准备

```bash
# 1. 后端依赖
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
pip install -r requirements.txt

# 2. 前端依赖
cd ../frontend
npm install

# 3. 启动数据库 (Docker)
docker-compose up -d postgres redis

# 4. 按 Ctrl+Shift+B 启动全栈开发
```

### 调试技巧

1. **后端断点**: 在 Python 代码中设置断点，选择"后端: FastAPI"启动
2. **前端断点**: 在 `.tsx` 文件中设置断点，先运行 `npm run dev`，再选择"前端: Chrome"
3. **API 测试**: 访问 http://localhost:8000/docs 使用 Swagger UI
4. **热重载**: 后端和前端都支持热重载，修改代码后自动生效
