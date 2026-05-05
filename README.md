# PPAP Tab

PPAP Tab is a VS Code extension that provides Cursor/Copilot-style inline ghost-text completion through any OpenAI-compatible chat completion endpoint.

The default local setup targets Cameron's RPi PPAP endpoint and `gpt-5.3-codex-spark`, but the extension is not tied to that deployment. It reads endpoint credentials from environment variables, registers a native VS Code `InlineCompletionItemProvider`, shows suggestions as ghost text, and accepts them with VS Code's normal Tab inline-suggestion command.

## Features

- Inline ghost-text completion using the VS Code inline completion API.
- `Tab` accepts visible suggestions when VS Code has `editor.action.inlineSuggest.commit` bound.
- `Alt+\` manually triggers a suggestion.
- Open/visible file snippets are included as extra context for Cursor-like behavior.
- Typing-as-suggested reuse keeps the remaining suggestion visible while the user types into it.
- Recent request cache and in-flight request de-duplication reduce repeated calls.
- Completion cleanup removes Markdown fences, echoed context, cursor markers, and suffix overlap.
- Runtime status bar item and `PPAP Tab` output channel for diagnostics.

## Configuration

Set these environment variables before launching VS Code:

```powershell
[Environment]::SetEnvironmentVariable('补全url', 'http://your-openai-compatible-host/v1', 'User')
[Environment]::SetEnvironmentVariable('补全key', '<your-api-key>', 'User')
```

The extension also recognizes `PPAP_COMPLETION_URL` and `PPAP_COMPLETION_KEY` as ASCII aliases. The API key should not be committed to this repository or written into VS Code settings.

Useful VS Code settings:

```json
{
  "editor.inlineSuggest.enabled": true,
  "ppapTab.enabled": true,
  "ppapTab.model": "gpt-5.3-codex-spark",
  "ppapTab.urlEnvName": "补全url",
  "ppapTab.keyEnvName": "补全key",
  "ppapTab.includeOpenFilesContext": true,
  "ppapTab.maxOpenFiles": 3,
  "ppapTab.debounceMs": 220
}
```

## Commands

- `PPAP Tab: Trigger Inline Completion`
- `PPAP Tab: Toggle`
- `PPAP Tab: Test API`
- `PPAP Tab: Show Output`

## Build

```powershell
npx --yes @vscode/vsce package --no-dependencies
```

Install the generated VSIX:

```powershell
code --install-extension .\ppap-tab-0.2.0.vsix --force
```

Reload VS Code after installation so the extension and environment variables are picked up.

## Relationship To Other Products

PPAP Tab is an independent extension. It is not affiliated with GitHub Copilot, Cursor, Continue, Tabby, Microsoft, GitHub, Anysphere, or TabbyML.

The implementation uses public VS Code extension APIs. The design was informed by publicly available products and documentation:

- [GitHub Copilot Chat's open-source VS Code extension repository](https://github.com/microsoft/vscode-copilot-chat), especially its MIT-licensed ghost-text provider architecture and inline completion lifecycle ideas.
- [Continue's autocomplete documentation](https://docs.continue.dev/customize/deep-dives/autocomplete) around debounce, suffix/prefix context, multi-line completions, conflict avoidance, and Tab acceptance.
- [Tabby's public product documentation](https://www.tabbyml.com/) as an open-source AI coding assistant with code completion and IDE integration.
- [Cursor's public repository/download page](https://github.com/cursor/cursor) and product behavior as a benchmark for multi-line, context-aware Tab completion. Cursor's full autocomplete implementation is not copied here.

No proprietary Cursor or GitHub Copilot service code is bundled in this project.

## Security

Do not put API keys in repository files, release notes, screenshots, logs, or VS Code settings. PPAP Tab reads keys from environment variables at runtime and keeps the previous local env-file path only as a backward-compatible fallback for Cameron's machine.
