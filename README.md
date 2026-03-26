# Novelva — AI 多语言阅读学习桌面应用

<p align="center">
  <strong>沉浸式阅读 · AI 智能解析 · 语法深度分析 · 高效记忆</strong>
</p>

基于 Electron + React + TypeScript 构建的桌面端 AI 多语言阅读学习应用。导入外语原著（英语、日语、德语等），点击句子即可获得 AI 翻译、语法分析与词汇解析，搭配第三方词典和间隔复习系统高效记忆。

---

## 功能特性

### 多语言支持
- 支持 **英语、日语、德语、法语、西班牙语** 等多种语言
- AI 自动识别文本语言，无需手动设置
- 日语标注读音，德语名词收藏时自动去除冠词、首字母大写保留，**词性标签**显示在词汇本列表和详情页
- **多词性支持**：同一单词可同时拥有多个词性（名词+形容词等），每个义项独立显示词性标签

### 阅读器
- 支持 **TXT / PDF / EPUB** 文件导入，智能段落与句子拆分
- PDF 跨页断句自动合并，还原完整句子
- 阅读进度自动保存与恢复，支持最近阅读书架
- **返回书架**：阅读中可点击返回箭头回到书架选书
- 可调节字体大小和行距，明暗主题切换

### AI 句子解析
- 点击任意句子，AI 自动返回**中文翻译、语法点分析、关键表达、语境说明、词汇列表**
- **语法深度分析**：每句话涉及的语法现象（时态、从句、敬语、格变化等）逐条解析
- **流式解析**：句子 AI 解析采用流式传输，数据实时到达，大幅减少等待时间
- **Token 优化**：精简 Prompt 指令、限制输出长度（max_tokens 1200）、仅返回最具学习价值的内容，显著降低 API 费用和响应时间
- 解析结果自动缓存，相同句子不重复调用 AI，节省 API 费用
- 支持**一键重新生成**：对翻译或解析不满意时，可在浮窗中点击刷新按钮重新请求 AI
- **加载体验优化**：解析等待时显示骨架屏动画 + 计时器，减少等待焦虑

### 自由提问
- 选中任意文本后出现提问按钮，点击可自由向 AI 提问
- 支持任意长度的文本选择，可针对词组、句子或段落提问
- 临时对话模式，不缓存结果

### 单词查询
- 句子解析后，点击句中单词即可查看 AI 词义解析
- 本地缓存词义，减少重复请求

### 词汇本
- 收藏的单词按义项分组，每个义项关联不同语境下的例句
- 词汇详情页集成**第三方词典 API**：音标、发音、多义项、近义词、词源等
- 默认内置 **Free Dictionary API**（英语）、**Jisho API**（日语）、**Wiktionary API**（德语，支持 REST API 和 MediaWiki API 两种格式，自动解析 wikitext 提取词性、性别(der/die/das)、IPA 音标、释义），可在设置中自由配置
- **例句高亮**：词汇详情和列表中，当前单词在例句中自动高亮显示
- **AI 词汇深度解析**：每个语言特定的提示词，英语着重词根词缀、德语着重变位变格表、日语着重活用形等
- **可折叠显示**：AI 词汇详解支持展开/收起，不占据过多页面空间
- **流式输出**：AI 词汇详解支持实时流式显示，边生成边阅读，减少等待时间
- **结果缓存**：AI 词汇详解结果自动存入数据库，同一单词不重复调用 AI
- 支持单个词汇的提示词临时修改，支持重新生成
- **按语言筛选**：多语言混合学习时，可按语言分类查看词汇
- **按来源筛选**：按书名/文件筛选词汇，方便按小说分组复习
- 增量渲染 + 虚拟滚动优化，大量词汇不卡顿
- 实时刷新：添加新词后切换到词汇本立即可见

### 复习模式
- 基于间隔重复算法（SM-2）的 FlashCard 背单词
- **语言筛选**：可选择只复习特定语言的词汇
- **来源筛选**：可选择只复习来自特定书籍的词汇
- 可配置每日复习数量，自动记录复习进度与难度等级

### 设置
- **多 AI 服务提供商**：支持 DeepSeek、OpenAI、Gemini、Grok、Kimi、Qwen 等，可自由切换
- **自定义提供商**：支持任何 OpenAI 兼容接口（Ollama、LM Studio、Azure 等）
- 每个提供商可选择不同模型，API Key 本地存储（不上传服务器）
- AI 用量统计（调用次数、Token 消耗）
- **词典 API 配置**：按语言配置第三方词典 URL，支持添加/删除/自定义
- **词汇详解 AI 提示词**：每种语言独立配置，预设英/德/日/法/西/韩 6 种语言专属提示词
- 高级 Prompt 模板自定义（仅可编辑分析指令部分，JSON 返回格式锁定不可修改）
- 自定义外观（字体大小、行距、深色模式）

---

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Electron 41 + Electron Forge + Vite |
| 前端 | React 19 + TypeScript |
| 样式 | TailwindCSS 3 + tailwindcss-animate |
| 状态管理 | Zustand 5 |
| 数据库 | sql.js（SQLite WASM，本地持久化） |
| PDF 解析 | pdf-parse |
| EPUB 解析 | adm-zip（手动解析 OPF/spine） |
| AI | 多提供商：DeepSeek / OpenAI / Gemini / Grok / Kimi / Qwen / 自定义 |
| 词典 | Free Dictionary API（英语）+ Jisho API（日语）+ Wiktionary API（德语）+ 可配置 |
| UI 组件 | Radix UI + Lucide React Icons |

---

## 快速开始

### 环境要求

- **Node.js** >= 18
- **npm** >= 9
- **Windows 10/11**（macOS/Linux 理论支持，未测试）

### 开发

```bash
# 克隆项目
git clone <repo-url>
cd readingapp

# 安装依赖
npm install

# 启动开发环境（自动打开 Electron 窗口）
npm start
```

### 使用说明

1. 首次启动 → 进入**设置**页面 → 选择 AI 服务提供商并输入 API Key
2. 切换到**阅读** → 点击**打开文件** → 导入 TXT / PDF / EPUB 文件（支持多语言）
3. 点击任意句子 → AI 自动识别语言并解析，浮窗显示翻译、语法点与词汇
4. 对解析不满意 → 点击浮窗标题栏的 **↻** 按钮重新生成
5. 选中一段文本 → 点击浮现的 💬 按钮 → 自由向 AI 提问
6. 点击词汇旁的 **＋** 按钮加入词汇本
7. 切换到**词汇本**，可按语言或来源书籍筛选词汇
8. 点击词汇进入详情页 → 查看词典详情 + 点击「生成 AI 词汇详解」获取深度分析
9. 切换到**复习**，可按语言筛选后进入 FlashCard 背单词模式

---

## 打包与分发

### 一键生成 Windows 安装程序

```bash
# 生成图标（首次或图标变更时）
node scripts/generate-icon.mjs

# 生成安装包（输出到 out/ 目录）
npm run make
```

生成完成后，安装程序位于：

```
out/make/squirrel.windows/x64/Novelva-Setup.exe
```

将此 `.exe` 文件发送给用户，双击即可安装。

### 仅打包（不生成安装程序）

```bash
npm run package
```

打包产物位于 `out/Novelva-win32-x64/`。

### 打包说明

- Windows 安装程序使用 **Squirrel.Windows**，支持自动安装/卸载/快捷方式
- 自带应用图标（`resources/icon.ico`）
- `sql-wasm.wasm` 文件通过 `extraResource` 自动复制到产物的 `resources/` 目录
- 生产环境自动禁用 DevTools

---

## 项目结构

```
src/
├── main.ts                      # Electron 主进程入口
├── preload.ts                   # Preload 脚本（IPC bridge）
├── renderer.tsx                 # React 渲染进程入口
├── App.tsx                      # React 根组件（布局 + 路由）
├── database/
│   └── index.ts                 # sql.js 数据库初始化、迁移与持久化
├── ipc/
│   ├── ai-handler.ts            # AI API 调用 IPC（多提供商 + 流式输出）
│   ├── database-handler.ts      # 数据库 CRUD IPC
│   └── file-handler.ts          # 文件导入 IPC（TXT/PDF/EPUB）
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx          # 侧边栏导航
│   ├── reader/
│   │   ├── ReaderView.tsx       # 阅读主视图（滚动/进度/书架）
│   │   ├── Paragraph.tsx        # 段落组件（共享 IntersectionObserver）
│   │   ├── Sentence.tsx         # 句子组件（点击触发 AI 解析）
│   │   └── WordSpan.tsx         # 可点击单词
│   ├── ai/
│   │   ├── SentencePopover.tsx  # 句子 AI 解析浮窗（语法+词汇+翻译）
│   │   ├── WordPopover.tsx      # 单词释义浮窗（AI 查询）
│   │   ├── SelectionAskButton.tsx # 文本选中提问按钮
│   │   └── SelectionAskDialog.tsx # 自由提问对话框
│   ├── vocabulary/
│   │   ├── VocabularyList.tsx   # 词汇本（语言/来源筛选 + 详情页）
│   │   ├── DictionaryDetail.tsx # 第三方词典详情（音标/发音/释义/词源）
│   │   └── VocabAIAnalysis.tsx  # AI 词汇深度解析（每语言独立提示词）
│   ├── review/
│   │   └── FlashCard.tsx        # 间隔复习 FlashCard（语言/来源筛选）
│   └── settings/
│       └── SettingsPanel.tsx    # 设置面板（卡片式 UI）
├── stores/
│   ├── reader-store.ts          # 阅读器状态（Zustand）
│   ├── ai-store.ts              # AI 解析状态（含语法点）
│   └── settings-store.ts        # 用户设置（Prompt + 词典 + 词汇提示词配置）
├── hooks/
│   ├── use-file-import.ts       # 文件导入 hook
│   ├── use-ai-analysis.ts       # AI 分析（纯函数，非 hook）
│   └── use-vocabulary.ts        # 词汇本操作 hook（含语言字段）
├── lib/
│   ├── utils.ts                 # 工具函数（cn）
│   ├── hash.ts                  # 句子哈希生成
│   ├── sentence-splitter.ts     # 智能段落/句子拆分（PDF 跨页修复）
│   └── ipc-client.ts            # IPC 客户端封装
└── styles/
    └── globals.css              # 全局样式 + 自定义滚动条 + CSS 变量
```

## 数据库

数据库文件存储在系统用户数据目录：`%APPDATA%/Novelva/reading-app.db`

| 表 | 用途 |
|---|---|
| `sentence_cache` | AI 句子解析缓存（翻译、语法点、关键表达、词汇、语言） |
| `word_cache` | 单词释义缓存 |
| `vocab_analysis_cache` | AI 词汇深度解析结果缓存 |
| `vocabulary` | 用户词汇本（单词、释义、来源句子、语言） |
| `reading_progress` | 阅读进度（文件路径、滚动位置、语言） |
| `review_schedule` | 间隔复习调度（SM-2 算法参数） |
| `settings` | 用户设置键值对 |

---

## 作者

**非菓** — 1985430202@qq.com

## License

MIT
