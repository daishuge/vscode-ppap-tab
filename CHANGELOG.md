# Changelog

## 0.2.1

- Keep in-flight PPAP requests alive after VS Code cancels an automatic inline-completion request.
- Cache late completions and retrigger inline suggestions when the cursor has not moved.
- Use zero debounce, expand prefix/suffix/open-file context, increase completion budget, actively trigger inline suggestions after edits and cursor movement, and prewarm the environment cache for faster first completions.

## 0.2.0

- Move PPAP Tab into a standalone project ready for GitHub release.
- Read endpoint and key from `补全url` and `补全key` environment variables, with ASCII aliases.
- Add open-file context, typing-as-suggested reuse, request caching, in-flight request de-duplication, and stronger completion cleanup.
- Use the stable VS Code inline-completion provider API so normal VSIX installs activate without proposed API flags.

## 0.1.0

- Initial local VS Code inline completion provider for PPAP.
