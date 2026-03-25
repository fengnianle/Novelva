# AI Reading App - AI 英语阅读学习桌面应用 (MVP)

基于 Electron + React + TypeScript 构建的沉浸式 AI 英语阅读学习桌面应用。

## 功能特性

- **阅读器** — 支持 TXT / PDF / EPUB 文件导入，保留原始段落结构，滚动阅读
- **句子解析** — 点击句子触发 AI 解析，显示翻译、关键表达和语法说明
- **单词查询** — 句子解析后可点击单词查看词义（本地缓存，不额外请求 AI）
- **词汇本** — 收藏单词到词汇本，支持同一单词多条记录（不同语境）
- **复习模式** — 随机抽词的 FlashCard 背单词模式
- **深色模式** — 支持明暗主题切换
- **阅读设置** — 可调节字体大小、行距
- **AI 缓存** — 相同句子不重复调用 AI，节省 API 成本

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron Forge + Vite |
| 前端 | React 18 + TypeScript |
| 样式 | TailwindCSS 3 + tailwindcss-animate |
| 数据库 | sql.js (SQLite WASM) |
| PDF 解析 | pdf-parse |
| EPUB 解析 | adm-zip (手动解析) |
| AI | DeepSeek API (deepseek-chat) |
| 状态管理 | zustand |
| UI 组件 | Radix UI + Lucide Icons |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发环境
npm start
```

## 使用说明

1. 首次启动后，进入 **设置** 页面，输入你的 DeepSeek API Key
2. 点击 **阅读** → **打开文件**，导入 TXT / PDF / EPUB 文件
3. 点击任意英文句子，AI 将自动解析并显示浮窗
4. 在浮窗中点击单词旁的 ＋ 按钮可加入词汇本
5. 句子解析后，点击句子中的单词可查看词义
6. 切换到 **词汇本** 查看已收藏的词汇
7. 切换到 **复习** 进入 FlashCard 背单词模式

## 项目结构

```
src/
├── main.ts                     # Electron 主进程入口
├── preload.ts                  # Preload 脚本 (IPC bridge)
├── renderer.tsx                # React 渲染进程入口
├── App.tsx                     # React 根组件
├── database/
│   └── index.ts                # sql.js 数据库初始化与操作
├── ipc/
│   ├── ai-handler.ts           # AI 调用 IPC
│   ├── database-handler.ts     # 数据库操作 IPC
│   └── file-handler.ts         # 文件导入 IPC (TXT/PDF/EPUB)
├── components/
│   ├── layout/Sidebar.tsx      # 侧边栏导航
│   ├── reader/
│   │   ├── ReaderView.tsx      # 阅读主视图
│   │   ├── Paragraph.tsx       # 段落组件
│   │   ├── Sentence.tsx        # 可点击句子
│   │   └── WordSpan.tsx        # 可点击单词
│   ├── ai/
│   │   ├── SentencePopover.tsx # 句子 AI 解析浮窗
│   │   └── WordPopover.tsx     # 单词释义浮窗
│   ├── vocabulary/
│   │   └── VocabularyList.tsx  # 词汇本列表
│   ├── review/
│   │   └── FlashCard.tsx       # 复习 FlashCard
│   └── settings/
│       └── SettingsPanel.tsx   # 设置面板
├── stores/
│   ├── reader-store.ts         # 阅读器状态
│   ├── ai-store.ts             # AI 状态
│   └── settings-store.ts       # 设置状态
├── hooks/
│   ├── use-file-import.ts      # 文件导入 hook
│   ├── use-ai-analysis.ts      # AI 分析 hook
│   └── use-vocabulary.ts       # 词汇本 hook
├── lib/
│   ├── utils.ts                # 工具函数 (cn)
│   ├── hash.ts                 # 句子哈希
│   ├── sentence-splitter.ts    # 句子/段落拆分
│   └── ipc-client.ts           # IPC 客户端封装
└── styles/
    └── globals.css             # 全局样式 + CSS 变量
```

## 数据库表

- **sentence_cache** — AI 句子解析缓存
- **word_cache** — 单词释义缓存
- **vocabulary** — 用户词汇本
- **reading_progress** — 阅读进度（扩展用）
- **settings** — 用户设置

## 打包

```bash
npm run make
```

## License

MIT
