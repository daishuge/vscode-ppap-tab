# PPAP Tab

中文 | [English](#english)

PPAP Tab 是一个开源 VSCode inline ghost-text 自动补全扩展。它使用 VSCode 原生 inline completion API，把任意 OpenAI-compatible `/v1/chat/completions` endpoint 接入编辑器，提供类似 Cursor Tab / GitHub Copilot 的自动补全体验。

这个项目不绑定某个私有服务。你可以接入自建网关、本地模型服务、云厂商 OpenAI-compatible API，或任何兼容 chat completions 的代码模型。

## 功能

- 自动显示 inline ghost text，不需要每次手动触发。
- `Tab` 接受当前可见建议。
- 支持单行和多行补全。
- 使用当前文件 prefix/suffix、当前光标窗口、可见/已打开文件片段作为上下文。
- 默认体验优先：零 debounce、编辑后主动触发、光标移动后主动触发、较大的上下文和补全预算。
- aggressive trigger 模式会在常见编辑器动作后主动触发补全：输入、空格、回车、退格、删除、粘贴、剪切、复制、撤回、重做、方向键、选择移动、Home/End、PageUp/PageDown、切换文件、打开/保存文件、滚动可见区域、窗口重新获得焦点。
- 每次触发会发起多次 trigger burst，避免快速连续操作时前一次触发被后一次覆盖。
- VSCode 取消自动补全请求后，仍保留已经发出的网络请求；结果返回后会缓存，并在光标未移动时重新触发显示。
- 用户继续输入、删除、粘贴、撤回等导致文档内容变化时，会立即丢弃并 abort 当前文档的旧请求，避免旧补全回到新上下文。
- 右下角状态栏反映真实请求状态：请求未结束时转圈，并发请求时显示数量，全部结束后才回到 ready 或 warning。
- API key 只从环境变量读取，不写入仓库、VSCode settings 或 release 包。

## 安装

从 GitHub Releases 下载最新版 VSIX，例如 `ppap-tab-0.2.2.vsix`：

```powershell
code --install-extension .\ppap-tab-0.2.2.vsix --force
```

安装后执行 `Developer: Reload Window`，或重启 VSCode。

## 基础配置

推荐使用通用 ASCII 环境变量：

```powershell
[Environment]::SetEnvironmentVariable('PPAP_COMPLETION_URL', 'https://your-openai-compatible-host/v1', 'User')
[Environment]::SetEnvironmentVariable('PPAP_COMPLETION_KEY', '<your-api-key>', 'User')
```

也支持中文环境变量名：

```powershell
[Environment]::SetEnvironmentVariable('补全url', 'https://your-openai-compatible-host/v1', 'User')
[Environment]::SetEnvironmentVariable('补全key', '<your-api-key>', 'User')
```

VSCode settings 示例：

```json
{
  "editor.inlineSuggest.enabled": true,
  "ppapTab.enabled": true,
  "ppapTab.model": "your-code-model",
  "ppapTab.debounceMs": 0,
  "ppapTab.timeoutMs": 15000,
  "ppapTab.maxPrefixChars": 12000,
  "ppapTab.maxSuffixChars": 4000,
  "ppapTab.maxCompletionTokens": 256,
  "ppapTab.includeOpenFilesContext": true,
  "ppapTab.maxOpenFiles": 8,
  "ppapTab.maxOpenFileChars": 4000,
  "ppapTab.autoTriggerAfterEdit": true,
  "ppapTab.autoTriggerAfterCursorMove": true,
  "ppapTab.autoTriggerDelayMs": 0,
  "ppapTab.aggressiveAutoTrigger": true,
  "ppapTab.discardPendingOnEdit": true,
  "ppapTab.autoTriggerBurstCount": 3,
  "ppapTab.autoTriggerBurstIntervalMs": 80
}
```

如果你希望显式指定环境变量名：

```json
{
  "ppapTab.urlEnvName": "PPAP_COMPLETION_URL",
  "ppapTab.keyEnvName": "PPAP_COMPLETION_KEY"
}
```

## 自动补全检查

如果没有自动出现建议，先检查：

- `editor.inlineSuggest.enabled` 是否为 `true`。
- `ppapTab.enabled` 是否为 `true`。
- `ppapTab.autoTriggerAfterEdit` 是否为 `true`。
- `ppapTab.autoTriggerAfterCursorMove` 是否为 `true`。
- `ppapTab.aggressiveAutoTrigger` 是否为 `true`。
- `ppapTab.discardPendingOnEdit` 是否为 `true`，这样继续输入会废弃旧请求。
- VSCode 是否已经执行 `Developer: Reload Window`。
- `PPAP Tab: Test API` 是否能返回成功。
- `PPAP Tab: Show Output` 中是否有 endpoint、鉴权、超时或模型错误。

## 命令和快捷键

- `PPAP Tab: Trigger Inline Completion`: 手动触发一次补全，默认快捷键 `Alt+\`。
- `PPAP Tab: Toggle`: 开关 PPAP Tab。
- `PPAP Tab: Test API`: 测试当前 endpoint、key 和 model。
- `PPAP Tab: Show Output`: 打开 `PPAP Tab` 输出日志。
- `Tab`: 接受当前可见 inline suggestion。

## 从源码构建

```powershell
npx --yes @vscode/vsce package --no-dependencies
```

## 兼容接口

PPAP Tab 期望 endpoint 支持：

- `POST /v1/chat/completions`
- `Authorization: Bearer <key>`
- 请求字段：`model`、`messages`、`max_tokens`、`temperature`、`stream`
- 响应字段：`choices[0].message.content`

流式响应不是必需的；当前扩展使用非流式请求。

## 与其他产品的关系

PPAP Tab 使用公开 VSCode Extension API 自研实现，不隶属于 GitHub Copilot、Cursor、Continue、Tabby、Microsoft、GitHub 或 Anysphere。

产品体验和实现思路参考了公开资料：

- GitHub Copilot Chat 的开源 VSCode 扩展仓库。
- Continue 的 autocomplete 文档。
- Tabby 的开源 AI coding assistant 文档。
- Cursor 的公开产品行为。

没有复制或打包 Cursor / GitHub Copilot 的闭源服务代码。

## 安全

不要把 API key 写入仓库、README、release notes、截图、日志或 VSCode settings。PPAP Tab 默认从环境变量读取 key，并保留本机兼容 fallback env-file 路径；发布包不包含任何凭据。

## English

PPAP Tab is an open-source VSCode inline ghost-text completion extension. It uses the native VSCode inline completion API and connects any OpenAI-compatible `/v1/chat/completions` endpoint to the editor, aiming for a Cursor Tab / GitHub Copilot-like completion experience.

The project is not tied to a private service. You can use a self-hosted gateway, a local model server, a cloud OpenAI-compatible API, or any code model that supports chat completions.

## Features

- Automatically shows inline ghost-text suggestions without manual triggering.
- Accepts the current visible suggestion with `Tab`.
- Supports single-line and multi-line completions.
- Uses current-file prefix/suffix, a cursor-window snippet, and visible/open file snippets as context.
- Prioritizes user experience by default: zero debounce, active triggers after edits and cursor movement, and larger context/completion budgets.
- Aggressive trigger mode actively triggers completion after common editor actions: typing, Space, Enter, Backspace, Delete, paste, cut, copy, undo, redo, arrow movement, selection movement, Home/End, PageUp/PageDown, editor switching, document open/save, visible range scrolling, and window focus.
- Each event schedules multiple trigger bursts, so rapid consecutive editor actions do not cancel earlier trigger attempts.
- Keeps in-flight network requests alive after VSCode cancels an automatic inline request; late responses are cached and retriggered when the cursor has not moved.
- When the user keeps typing, deleting, pasting, undoing, or otherwise changes document text, pending requests for that document are immediately discarded and aborted so old completions cannot return into a newer context.
- The bottom-right status bar reflects real request state: it spins while requests are active, shows concurrent request count, and returns to ready or warning only after all requests finish.
- Reads API keys from environment variables only; keys are not written to the repository, VSCode settings, or release packages.

## Install

Download the latest VSIX from GitHub Releases, for example `ppap-tab-0.2.2.vsix`:

```powershell
code --install-extension .\ppap-tab-0.2.2.vsix --force
```

Then run `Developer: Reload Window` or restart VSCode.

## Basic Configuration

Recommended ASCII environment variables:

```powershell
[Environment]::SetEnvironmentVariable('PPAP_COMPLETION_URL', 'https://your-openai-compatible-host/v1', 'User')
[Environment]::SetEnvironmentVariable('PPAP_COMPLETION_KEY', '<your-api-key>', 'User')
```

Chinese environment variable names are also supported:

```powershell
[Environment]::SetEnvironmentVariable('补全url', 'https://your-openai-compatible-host/v1', 'User')
[Environment]::SetEnvironmentVariable('补全key', '<your-api-key>', 'User')
```

Example VSCode settings:

```json
{
  "editor.inlineSuggest.enabled": true,
  "ppapTab.enabled": true,
  "ppapTab.model": "your-code-model",
  "ppapTab.debounceMs": 0,
  "ppapTab.timeoutMs": 15000,
  "ppapTab.maxPrefixChars": 12000,
  "ppapTab.maxSuffixChars": 4000,
  "ppapTab.maxCompletionTokens": 256,
  "ppapTab.includeOpenFilesContext": true,
  "ppapTab.maxOpenFiles": 8,
  "ppapTab.maxOpenFileChars": 4000,
  "ppapTab.autoTriggerAfterEdit": true,
  "ppapTab.autoTriggerAfterCursorMove": true,
  "ppapTab.autoTriggerDelayMs": 0,
  "ppapTab.aggressiveAutoTrigger": true,
  "ppapTab.discardPendingOnEdit": true,
  "ppapTab.autoTriggerBurstCount": 3,
  "ppapTab.autoTriggerBurstIntervalMs": 80
}
```

To explicitly select environment variable names:

```json
{
  "ppapTab.urlEnvName": "PPAP_COMPLETION_URL",
  "ppapTab.keyEnvName": "PPAP_COMPLETION_KEY"
}
```

## Auto-Completion Checklist

If suggestions do not appear automatically, check:

- `editor.inlineSuggest.enabled` is `true`.
- `ppapTab.enabled` is `true`.
- `ppapTab.autoTriggerAfterEdit` is `true`.
- `ppapTab.autoTriggerAfterCursorMove` is `true`.
- `ppapTab.aggressiveAutoTrigger` is `true`.
- `ppapTab.discardPendingOnEdit` is `true`, so continued typing invalidates old requests.
- VSCode has been reloaded with `Developer: Reload Window`.
- `PPAP Tab: Test API` succeeds.
- `PPAP Tab: Show Output` has no endpoint, auth, timeout, or model errors.

## Commands And Shortcuts

- `PPAP Tab: Trigger Inline Completion`: manually trigger one completion, default shortcut `Alt+\`.
- `PPAP Tab: Toggle`: enable or disable PPAP Tab.
- `PPAP Tab: Test API`: test the configured endpoint, key, and model.
- `PPAP Tab: Show Output`: open the `PPAP Tab` output channel.
- `Tab`: accept the current visible inline suggestion.

## Build From Source

```powershell
npx --yes @vscode/vsce package --no-dependencies
```

## Compatible API Shape

PPAP Tab expects the endpoint to support:

- `POST /v1/chat/completions`
- `Authorization: Bearer <key>`
- Request fields: `model`, `messages`, `max_tokens`, `temperature`, `stream`
- Response field: `choices[0].message.content`

Streaming is not required; the extension currently uses non-streaming requests.

## Relationship To Other Products

PPAP Tab is implemented with public VSCode Extension APIs. It is not affiliated with GitHub Copilot, Cursor, Continue, Tabby, Microsoft, GitHub, or Anysphere.

The product behavior and implementation approach are informed by public materials:

- GitHub Copilot Chat's open-source VSCode extension repository.
- Continue's autocomplete documentation.
- Tabby's open-source AI coding assistant documentation.
- Cursor's public product behavior.

No proprietary Cursor or GitHub Copilot service code is copied or bundled.

## Security

Do not put API keys in repository files, README content, release notes, screenshots, logs, or VSCode settings. PPAP Tab reads keys from environment variables at runtime and keeps a local compatibility fallback env-file path; release packages do not contain credentials.
