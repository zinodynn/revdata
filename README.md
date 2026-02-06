# Review Dataset Platform

> English | [中文说明](#%E4%B8%AD%E6%96%87%E7%89%88%E6%9C%AC)

## Overview
A full-stack platform for collaborative dataset review, supporting multi-role workflows, task assignment, authorization code delegation, and real-time statistics. Built with FastAPI (backend) and React (frontend).

---

## Architecture Preview

```mermaid
flowchart TB
    %% Swimlanes
    subgraph SUPERADMIN["SUPERADMIN【超级管理员】"]
        direction TB
        SA1[Create Admin Account【创建管理员账户】]
        SA2[Manage All Users/Roles【管理所有用户权限/角色】]
        SA3[Monitor System Health【监控系统健康状态】]
        SA4[View Global Reports【查看全局统计报告】]
    end

    subgraph ADMIN["ADMIN【管理员】"]
        direction TB
        A1[Upload Raw Data【上传原始数据】] --> A2[Manage User Permissions/Reset Password【管理用户权限/密码重置】]
        A2 --> A3[Configure Review Rules【配置审核规则】]
        A3 --> A4[Manage Document Library【管理文档库】]
        A4 --> A5[Export Review Results【导出审核结果】]
        A5 --> A6[Generate Reports【生成报告】]
    end

    subgraph REVIEWER["REVIEWER【审核员】"]
        direction TB
        R1[Receive Review Task【接收审核任务】] --> R2{Review Items【审核语料】}
        R2 -->|Certain| R3[Direct Approve/Reject/Edit【直接通过/拒绝/编辑变更】]
        R2 -->|Uncertain| R4[Mark for Delegation, Batch Select, Generate Auth Code【审核页面标记,批量选中,生成授权码】]
        R4 --> R5[Delegate to Assignee【委托给Assignee】]
        R3 --> R6[Update Review Status【更新审核状态】]
        R6 --> R7[View Task Statistics【查看任务统计】]
    end

    subgraph ASSIGNEE["ASSIGNEE【被委托人】"]
        direction TB
        AS1[Receive Auth Code/Link【接收授权码或链接】] --> AS2[Access Review Page【访问审核界面】]
        AS2 --> AS3[Review Delegated Items【审核委托语料】]
        AS3 --> AS4[Submit Review Results【提交审核结果】]
        AS4 -->|Auto Link| R6
    end

    subgraph SYSTEM["SYSTEM CORE【系统核心】"]
        direction TB
        S1[(Raw Data Pool【原始数据池】)]
        S2[(Review Task Queue【审核任务队列】)]
        S3[(Auth Code Management【授权码管理】)]
        S4[(Review Database【审核数据库】)]
        S5[(Export File Library【导出文件库】)]

        S1 -.->|Assign| S2
        S2 -->|Distribute Task| R1
        S3 -->|Verify| AS2
        S4 -->|Aggregate| S5
        S2 -->|Auto Assign by Tag| R1
        S2 -->|Manual Reviewer Assign| R1
    end

    %% Review Rule Configuration
    subgraph CONFIGURATION["CONFIGURATION【配置审核规则】"]
        direction TB
        CR1[Set Review Standards【设置审核标准】]
        CR2[Define Tag System【定义标签体系】]
        CR3[Configure Review Process【配置审核流程】]
        CR4[Set Time Limits【设定时间限制】]
        CR5[Custom Notifications【自定义通知和提醒】]
    end

    %% Cross-lane interactions
    SA1 -->|Create| ADMIN
    SA2 -->|Manage| REVIEWER
    SA2 -->|Manage| ASSIGNEE
    SA4 -->|View| SYSTEM

    A1 -->|Write| S1
    A3 -->|Set Rule| CR1
    A3 -->|Set Rule| CR2
    A3 -->|Set Rule| CR3
    A3 -->|Set Rule| CR4
    A3 -->|Set Rule| CR5
    A5 -->|Extract| S4
    R4 -->|Create| S3
    AS4 -->|Write| S4
    R5 -->|Share| AS1
    S2 -->|Task Notify| R1
    A4--->|Extract|S5

    %% Styles
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

    %% Important link styles
    linkStyle 10 stroke:#fa541c,stroke-width:2px;
    linkStyle 11 stroke:#fa541c,stroke-width:2px,stroke-dasharray:3;
    linkStyle 12 stroke:#13c2c2,stroke-width:2px;
```

---

## Quick Start

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```
API Docs: http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Visit: http://localhost:3000

### Docker Deployment
```bash
docker-compose up -d
```
Visit: http://localhost

### Default Account
Register via API:
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "email": "admin@example.com", "password": "admin123", "role": "super_admin"}'
```

---

## Project Structure
```
revdata/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/            # API routes
│   │   ├── core/           # Core config
│   │   ├── models/         # DB models
│   │   ├── schemas/        # Pydantic schemas
│   │   └── main.py         # Entry point
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                # React frontend
│   ├── src/
│   │   ├── components/     # Components
│   │   ├── pages/          # Pages
│   │   ├── services/       # API services
│   │   ├── stores/         # State management
│   │   └── App.tsx
│   ├── package.json
│   └── Dockerfile
└── docker-compose.yml
```

---

## Features

### MVP Stage ✅
- [x] User authentication (login/register/JWT)
- [x] Dataset upload (JSONL/JSON/CSV/TSV)
- [x] Card-style review interface
- [x] QA dialog split view
- [x] Diff highlighting (red/green)
- [x] Keyboard shortcuts (PgUp/PgDn/Ctrl+Enter, etc.)
- [x] Basic task assignment

### Keyboard Shortcuts
| Shortcut           | Function           |
| ------------------ | ----------------- |
| PgUp               | Previous item     |
| PgDn               | Next item         |
| Ctrl+Enter         | Approve & next    |
| Ctrl+Shift+Enter   | Reject & next     |
| Ctrl+E             | Edit mode         |
| Alt+S              | Save changes      |
| Esc                | Cancel edit       |

---

## API Docs
Backend API: http://localhost:8000/docs

---

## VS Code Development

### Recommended Extensions
VS Code will prompt to install recommended extensions on first open. Click "Install All".

### Debug Configurations
Press `F5` or use the "Run and Debug" panel:
| Name                | Description                                 |
| ------------------- | ------------------------------------------- |
| Backend: FastAPI    | Start backend server with breakpoints       |
| Frontend: Chrome    | Debug frontend in Chrome (start dev server) |
| Frontend: Edge      | Debug frontend in Edge                      |
| Fullstack Debug     | Start backend + Chrome debug                |

### Tasks
Press `Ctrl+Shift+B` for default (fullstack), or use "Run Task":
| Task Name                   | Description                      |
| --------------------------- | -------------------------------- |
| Fullstack: Start Dev        | Start both backend & frontend    |
| Backend: Start Dev          | Start FastAPI only               |
| Frontend: Start Dev         | Start Vite only                  |
| Docker: Start All Services  | docker-compose up -d             |
| Docker: Rebuild & Start     | docker-compose up -d --build     |

---

## 中文版本

> [English version above](#review-dataset-platform)

---

# 数据集审核平台

## 架构预览

> 架构图见[上方 Architecture Preview](#architecture-preview)

## 快速开始

### 后端
```bash
cd backend
python -m venv venv
.\venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```
API文档: http://localhost:8000/docs

### 前端
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

### 默认账户
首次使用需要通过 API 注册用户:
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "email": "admin@example.com", "password": "admin123", "role": "super_admin"}'
```

---

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

---

## 功能特性

### MVP 阶段 ✅
- [x] 用户认证 (登录/注册/JWT)
- [x] 数据集上传 (JSONL/JSON/CSV/TSV)
- [x] 卡片式审核界面
- [x] QA 对话左右分栏展示
- [x] 差异对比显示 (红绿高亮)
- [x] 快捷键支持 (PgUp/PgDn/Ctrl+Enter等)
- [x] 基础任务分配

### 快捷键
| 快捷键           | 功能         |
| ---------------- | ------------ |
| PgUp             | 上一条语料   |
| PgDn             | 下一条语料   |
| Ctrl+Enter       | 通过并下一条 |
| Ctrl+Shift+Enter | 拒绝并下一条 |
| Ctrl+E           | 进入编辑模式 |
| Alt+S            | 保存修改     |
| Esc              | 取消编辑     |

---

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


### 清理 middleware 数据集
你可以通过删除 Docker 卷来清理挂载的数据。具体步骤如下：

1. **停止并移除容器**
在项目目录下运行：
```
docker-compose -f docker-compose.middleware.yml down
```

2. **删除数据卷**
继续运行：
```
docker volume rm revdata_postgres_data revdata_redis_data
```
> 如果提示卷正在使用，可以加 `-f` 强制删除。

3. **重新启动服务并生成新卷**
```
docker-compose -f docker-compose.middleware.yml up -d
```

这样会清空原有数据，重新生成挂载的数据卷。
