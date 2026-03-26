# Novelva — AI 多语言阅读学习桌面应用

<p align="center">
  <strong>📚 沉浸式阅读 · 🤖 AI 智能解析 · 📝 语法深度分析 · 🧠 高效记忆</strong>
</p>

<p align="center">
  <a href="https://github.com/fengnianle/Novelva/releases/latest"><img src="https://img.shields.io/github/v/release/fengnianle/Novelva?style=flat-square" alt="Latest Release" /></a>
  <a href="https://github.com/fengnianle/Novelva/blob/main/LICENSE"><img src="https://img.shields.io/github/license/fengnianle/Novelva?style=flat-square" alt="License" /></a>
  <a href="https://github.com/fengnianle/Novelva/releases"><img src="https://img.shields.io/github/downloads/fengnianle/Novelva/total?style=flat-square" alt="Downloads" /></a>
</p>

> **面向中文用户的多语言 AI 阅读学习工具**  
> 导入外语原著，点击句子即可获得 AI 翻译、语法分析与词汇解析，搭配词典和间隔复习系统高效记忆。

---

## 🚀 快速开始

### 下载安装

前往 [GitHub Releases](https://github.com/fengnianle/Novelva/releases/latest) 下载最新版本：

1. ✅ 下载 `Novelva-Setup.exe`
2. ✅ 双击运行安装程序
3. ✅ 安装完成，桌面会出现 Novelva 快捷方式

> 💡 **提示**：应用内支持 **设置 → 检查更新** 自动获取最新版本

### 第一次使用

1. **配置 AI** → 打开设置 → 选择 AI 提供商（推荐 DeepSeek）→ 输入 API Key
2. **导入书籍** → 点击阅读 → 打开 TXT/PDF/EPUB 格式的外语书籍
3. **开始学习** → 点击任意句子 → 查看 AI 解析 → 收藏词汇

---

## 📖 使用教程

### 🎯 核心功能演示

| 功能 | 操作方式 | 效果 |
|---|---|---|
| **句子解析** | 点击任意句子 | 显示翻译、语法点、词汇列表 |
| **重新生成** | 点击浮窗的 **↻** 按钮 | 重新解析不满意的内容 |
| **自由提问** | 选中文本 → 点击 **💬** | 向 AI 提问任何问题 |
| **收藏词汇** | 点击词汇旁 **＋** | 加入词汇本 |
| **词汇详情** | 在词汇本中点击词汇 | 查看词典 + AI 深度解析 |
| **复习模式** | 切换到复习页面 | FlashCard 间隔重复记忆 |

### 📝 详细步骤

#### 1️⃣ 配置 AI 服务
- **推荐 DeepSeek**（性价比最高）：[注册获取 API Key](https://platform.deepseek.com)
- **其他选择**：OpenAI、Gemini、Grok、Kimi、Qwen，或自定义 OpenAI 兼容接口

#### 2️⃣ 导入书籍
- 支持格式：**TXT / PDF / EPUB**
- 智能拆分段落和句子
- 自动保存阅读进度

#### 3️⃣ AI 句子解析
- **自动语言识别**：无需手动设置
- **流式输出**：实时显示解析结果
- **缓存优化**：相同句子不重复调用 AI

#### 4️⃣ 词汇管理
- **多词性支持**：同一单词的不同词性分别显示
- **德语性别标注**：der/die/das 彩色徽章显示
- **第三方词典**：英语 Free Dictionary、日语 Jisho、德语 Wiktionary

#### 5️⃣ 复习巩固
- **间隔重复算法**：SM-2 算法自动安排复习
- **灵活筛选**：按语言、来源书籍筛选
- **进度追踪**：记录复习难度和进度

---

## ✨ 主要特性

### 🌍 多语言支持
- **支持语言**：英语、日语、德语、法语、西班牙语
- **智能识别**：AI 自动检测文本语言
- **特殊处理**：日语读音标注、德语性别显示

### 📚 阅读体验
- **多格式支持**：TXT / PDF / EPUB
- **智能断句**：PDF 跨页句子自动合并
- **进度保存**：自动保存阅读位置
- **个性化**：字体大小、行距、明暗主题

### 🤖 AI 智能解析
- **全面分析**：翻译 + 语法点 + 关键表达 + 词汇列表
- **流式输出**：边生成边显示，减少等待
- **成本优化**：精简 Prompt，降低 Token 消耗
- **重新生成**：不满意可重新解析

### 📖 词汇系统
- **智能分组**：按义项分组，关联例句
- **词典集成**：第三方词典 API 查询
- **AI 深度解析**：语言特定的详细解析
- **灵活筛选**：按语言、来源书籍筛选

### 🔄 复习系统
- **科学记忆**：间隔重复算法（SM-2）
- **个性化设置**：每日复习数量
- **进度追踪**：难度等级记录

### ⚙️ 个性化设置
- **多 AI 提供商**：DeepSeek、OpenAI、Gemini 等
- **自定义接口**：支持 OpenAI 兼容接口
- **本地存储**：API Key 本地保存，不上传服务器
- **用量统计**：调用次数、Token 消耗统计

---

## 🛠️ 技术栈

| 技术 | 用途 |
|---|---|
| **Electron 41 + Forge + Vite** | 桌面应用框架 |
| **React 19 + TypeScript** | 前端框架 |
| **TailwindCSS 3** | UI 样式 |
| **Zustand 5** | 状态管理 |
| **sql.js (SQLite WASM)** | 本地数据存储 |
| **pdf-parse** | PDF 文件解析 |
| **adm-zip** | EPUB 文件解析 |
| **多 AI 提供商** | DeepSeek、OpenAI、Gemini 等 |
| **第三方词典 API** | Free Dictionary、Jisho、Wiktionary |

---

## ❓ 常见问题

### Q: 支持哪些文件格式？
**A**: 支持 **TXT、PDF、EPUB** 三种格式。PDF 会自动处理跨页断句，EPUB 会自动解析章节结构。

### Q: AI 解析需要付费吗？
**A**: 需要使用您自己的 API Key。推荐使用 DeepSeek（性价比最高），也支持 OpenAI、Gemini 等。

### Q: 离线可以使用吗？
**A**: 基本功能可以。已解析的句子和词汇会缓存本地，但新内容的 AI 解析需要网络连接。

### Q: 数据存储在哪里？
**A**: 所有数据都存储在本地：`%APPDATA%/Novelva/reading-app.db`，不上传到任何服务器。

### Q: 如何备份数据？
**A**: 直接复制上述数据库文件即可备份所有学习数据。

### Q: 支持哪些语言？
**A**: 目前支持 **英语、日语、德语、法语、西班牙语**，AI 会自动识别文本语言。

### Q: 如何更新应用？
**A**: 在 **设置 → 检查更新** 中自动检测新版本，或访问 GitHub Releases 手动下载。

---

## 📄 开发者信息

### 环境要求
- **Node.js** >= 18
- **npm** >= 9
- **Windows 10/11**（macOS/Linux 理论支持，未测试）

### 从源码构建
```bash
# 克隆项目
git clone https://github.com/fengnianle/Novelva.git
cd Novelva

# 安装依赖
npm install

# 启动开发环境
npm start

# 打包发布版本
npm run make
```

### 项目结构
```
src/
├── main.ts                      # Electron 主进程
├── preload.ts                   # IPC 桥接
├── App.tsx                      # React 根组件
├── database/                    # 数据库初始化
├── ipc/                        # IPC 处理器
├── components/                  # React 组件
├── stores/                     # 状态管理
├── hooks/                      # 自定义 Hooks
└── styles/                     # 样式文件
```

### 数据存储
- **位置**: `%APPDATA%/Novelva/reading-app.db`
- **格式**: SQLite (sql.js WASM)
- **内容**: 句子缓存、词汇本、阅读进度、设置等

---

## 📋 更新日志

### 发布新版本（维护者指南）

1. **更新版本号**：修改 `package.json` 中的 `version`
2. **打包**：运行 `npm run make`
3. **创建 Tag**：`git tag v1.1.0 && git push origin main --tags`
4. **发布 Release**：在 GitHub 上创建 Release，上传 `Novelva-Setup.exe`
5. **验证**：用户可通过应用内 **设置 → 检查更新** 获取

---

##  许可证

本项目采用 [MIT 许可证](https://github.com/fengnianle/Novelva/blob/main/LICENSE) 开源。
