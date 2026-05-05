# Changelog

## 0.2.3

- Add aggressive trigger mode for nearly every editor movement or edit event.
- Wrap common editor keys and commands so Enter, Space, Backspace, Delete, paste, cut, copy, undo, redo, arrows, selection movement, Home, End, PageUp, and PageDown run the normal editor action and then trigger inline completion.
- Replace single debounce-style trigger scheduling with trigger bursts, so rapid editor events do not cancel earlier trigger attempts.
- Trigger after active editor changes, visible editor/range changes, document open/save, and window focus.

## 0.2.2

- Make the status bar reflect real in-flight PPAP request state with request counting.
- Keep the spinner visible while any network request is still pending, including late responses after VSCode cancellation.
- Show ready, disabled, or last-error states only after all active requests finish.

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
