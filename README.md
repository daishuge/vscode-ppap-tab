# PPAP Tab

中文 | [English](#english)

PPAP Tab 是一个开源 VSCode inline ghost-text / Tab 自动补全扩展。它通过 OpenAI-compatible `/v1/chat/completions` 接口调用模型，默认适配 Cameron 的 RPi PPAP endpoint 和 `gpt-5.3-codex-spark`，目标是在 VSCode 里提供接近 Cursor Tab / GitHub Copilot 的自动补全体验。

## 用途

- 在编辑器中显示 inline ghost text，并用 `Tab` 接受建议。
- 支持多行补全、当前文件 prefix/suffix、可见/已打开文件上下文。
- 体验优先：默认零 debounce、主动编辑后触发、主动光标移动后触发、放大上下文和补全 token budget。
- VSCode 取消自动补全请求后，仍保留已经发出的 PPAP 请求；结果返回后会缓存并在光标未移动时重新触发显示。
- 右下角状态栏忠实反映请求状态：真实网络请求未结束时保持转圈，多请求并发时显示请求数，全部结束后才切回 ready 或 warning。
- 不把 API key 写进仓库、VSCode settings 或 release 包。

## 安装

从 GitHub Release 下载最新版 VSIX，例如 `ppap-tab-0.2.2.vsix`，然后安装：

```powershell
code --install-extension .\ppap-tab-0.2.2.vsix --force
```

安装后重载 VSCode。

## 配置

推荐使用 user 级环境变量：

```powershell
[Environment]::SetEnvironmentVariable('补全url', 'http://your-openai-compatible-host/v1', 'User')
[Environment]::SetEnvironmentVariable('补全key', '<your-api-key>', 'User')
```

也支持 ASCII 别名：

```powershell
[Environment]::SetEnvironmentVariable('PPAP_COMPLETION_URL', 'http://your-openai-compatible-host/v1', 'User')
[Environment]::SetEnvironmentVariable('PPAP_COMPLETION_KEY', '<your-api-key>', 'User')
```

推荐 VSCode settings：

```json
{
  "editor.inlineSuggest.enabled": true,
  "ppapTab.enabled": true,
  "ppapTab.model": "gpt-5.3-codex-spark",
  "ppapTab.urlEnvName": "补全url",
  "ppapTab.keyEnvName": "补全key",
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
  "ppapTab.autoTriggerDelayMs": 0
}
```

## 命令和快捷键

- `PPAP Tab: Trigger Inline Completion`: 手动触发补全，默认快捷键 `Alt+\`。
- `PPAP Tab: Toggle`: 开关 PPAP Tab。
- `PPAP Tab: Test API`: 测试当前 endpoint 和 key。
- `PPAP Tab: Show Output`: 打开 `PPAP Tab` 输出日志。
- `Tab`: 接受 VSCode 当前可见 inline suggestion。

## 从源码构建

```powershell
npx --yes @vscode/vsce package --no-dependencies
```

## 使用的其他产品与边界

PPAP Tab 使用公开 VSCode Extension API 自研实现，不隶属于 GitHub Copilot、Cursor、Continue、Tabby、Microsoft、GitHub 或 Anysphere。

本项目的产品体验和实现思路参考了公开资料：

- GitHub Copilot Chat 的开源 VSCode 扩展仓库，参考 inline completion provider 和生命周期设计思路。
- Continue 的 autocomplete 文档，参考 prefix/suffix、debounce、上下文和 Tab 接受体验。
- Tabby 的开源 AI coding assistant 产品文档。
- Cursor 的公开产品行为，用作多行、上下文感知 Tab completion 的体验 benchmark。

没有复制或打包 Cursor / GitHub Copilot 的闭源服务代码。

## 安全

不要把 API key 写入仓库、README、release notes、截图、日志或 VSCode settings。PPAP Tab 默认从环境变量读取 key，并保留本机兼容 fallback env-file 路径，但发布包里不包含任何凭据。

## English

PPAP Tab is an open-source VSCode inline ghost-text / Tab completion extension. It calls an OpenAI-compatible `/v1/chat/completions` endpoint, defaults to Cameron's RPi PPAP endpoint with `gpt-5.3-codex-spark`, and aims to provide a Cursor Tab / GitHub Copilot-like completion experience inside VSCode.

## Purpose

- Show inline ghost-text suggestions and accept them with `Tab`.
- Support multi-line completions, current-file prefix/suffix context, and visible/open file context.
- Prioritize user experience: zero debounce by default, active triggers after edits and cursor movement, larger context windows, and a larger completion budget.
- Keep in-flight PPAP requests alive after VSCode cancels an automatic inline request; cache late responses and retrigger display when the cursor has not moved.
- Make the bottom-right status bar reflect real request state: keep spinning while network requests are active, show the in-flight count for concurrent requests, and only return to ready or warning after all requests finish.
- Keep API keys out of the repository, VSCode settings, and release packages.

## Install

Download the latest VSIX from GitHub Releases, for example `ppap-tab-0.2.2.vsix`, then install it:

```powershell
code --install-extension .\ppap-tab-0.2.2.vsix --force
```

Reload VSCode after installation.

## Configure

Set user-level environment variables:

```powershell
[Environment]::SetEnvironmentVariable('补全url', 'http://your-openai-compatible-host/v1', 'User')
[Environment]::SetEnvironmentVariable('补全key', '<your-api-key>', 'User')
```

ASCII aliases are also supported:

```powershell
[Environment]::SetEnvironmentVariable('PPAP_COMPLETION_URL', 'http://your-openai-compatible-host/v1', 'User')
[Environment]::SetEnvironmentVariable('PPAP_COMPLETION_KEY', '<your-api-key>', 'User')
```

Recommended VSCode settings:

```json
{
  "editor.inlineSuggest.enabled": true,
  "ppapTab.enabled": true,
  "ppapTab.model": "gpt-5.3-codex-spark",
  "ppapTab.urlEnvName": "补全url",
  "ppapTab.keyEnvName": "补全key",
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
  "ppapTab.autoTriggerDelayMs": 0
}
```

## Commands And Shortcuts

- `PPAP Tab: Trigger Inline Completion`: manually trigger completion, default shortcut `Alt+\`.
- `PPAP Tab: Toggle`: enable or disable PPAP Tab.
- `PPAP Tab: Test API`: test the configured endpoint and key.
- `PPAP Tab: Show Output`: open the `PPAP Tab` output channel.
- `Tab`: accept the current visible VSCode inline suggestion.

## Build From Source

```powershell
npx --yes @vscode/vsce package --no-dependencies
```

## Other Products And Attribution

PPAP Tab is implemented with public VSCode Extension APIs. It is not affiliated with GitHub Copilot, Cursor, Continue, Tabby, Microsoft, GitHub, or Anysphere.

The project is informed by public product behavior and documentation:

- GitHub Copilot Chat's open-source VSCode extension repository, especially inline completion provider and lifecycle ideas.
- Continue's autocomplete documentation for prefix/suffix context, debounce, and Tab acceptance behavior.
- Tabby's public documentation as an open-source AI coding assistant.
- Cursor's public product behavior as a benchmark for multi-line, context-aware Tab completion.

No proprietary Cursor or GitHub Copilot service code is copied or bundled.

## Security

Do not put API keys in repository files, README content, release notes, screenshots, logs, or VSCode settings. PPAP Tab reads keys from environment variables at runtime and keeps a local compatibility fallback env-file path, but release packages do not contain credentials.
