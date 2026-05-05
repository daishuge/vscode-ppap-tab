const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const vscode = require('vscode');

let output;
let statusBar;
let provider;
const envCache = new Map();
const statusState = {
  inFlight: 0,
  lastError: ''
};

const CURSOR_MARKER = '<|cursor|>';
const ENV_CACHE_TTL_MS = 30 * 60 * 1000;

function now() {
  return new Date().toISOString();
}

function log(message) {
  output?.appendLine(`[${now()}] ${message}`);
}

function shortStatusError(error) {
  return String(error?.message || error || '').replace(/\s+/g, ' ').slice(0, 180);
}

function renderStatus() {
  if (!statusBar) {
    return;
  }
  const enabled = getConfig().enabled;
  if (!enabled) {
    statusBar.text = '$(circle-slash) PPAP';
    statusBar.tooltip = 'PPAP Tab inline completion is disabled';
    statusBar.show();
    return;
  }
  if (statusState.inFlight > 0) {
    statusBar.text = statusState.inFlight > 1 ? `$(sync~spin) PPAP ${statusState.inFlight}` : '$(sync~spin) PPAP';
    statusBar.tooltip = `PPAP Tab is waiting for ${statusState.inFlight} request${statusState.inFlight === 1 ? '' : 's'}`;
    statusBar.show();
    return;
  }
  if (statusState.lastError) {
    statusBar.text = '$(warning) PPAP';
    statusBar.tooltip = `PPAP Tab last request failed: ${statusState.lastError}`;
    statusBar.show();
    return;
  }
  statusBar.text = '$(sparkle) PPAP';
  statusBar.tooltip = 'PPAP Tab inline completion is ready';
  statusBar.show();
}

function beginStatusRequest(kind) {
  statusState.inFlight += 1;
  statusState.lastError = '';
  renderStatus();
  log(`status begin ${kind}; inFlight=${statusState.inFlight}`);
  let ended = false;
  return (error) => {
    if (ended) {
      return;
    }
    ended = true;
    statusState.inFlight = Math.max(0, statusState.inFlight - 1);
    if (error) {
      statusState.lastError = shortStatusError(error);
    } else {
      statusState.lastError = '';
    }
    log(`status end ${kind}; inFlight=${statusState.inFlight}${error ? ` error=${statusState.lastError}` : ''}`);
    renderStatus();
  };
}

function makeRequestId() {
  return `ppap-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function simpleHash(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function readPersistentWindowsEnv(name) {
  if (process.platform !== 'win32' || !name) {
    return '';
  }
  const cached = envCache.get(name);
  if (cached && Date.now() - cached.time < ENV_CACHE_TTL_MS) {
    return cached.value;
  }
  const script = [
    '$utf8 = [System.Text.UTF8Encoding]::new($false)',
    '[Console]::InputEncoding = $utf8',
    '[Console]::OutputEncoding = $utf8',
    '$OutputEncoding = $utf8',
    '$name = $args[0]',
    "$value = [Environment]::GetEnvironmentVariable($name, 'User')",
    "if ([string]::IsNullOrEmpty($value)) { $value = [Environment]::GetEnvironmentVariable($name, 'Machine') }",
    'if ($null -ne $value) { [Console]::Out.Write($value) }'
  ].join('; ');
  try {
    const value = childProcess.execFileSync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script, name],
      { encoding: 'utf8', windowsHide: true, timeout: 2500 }
    ).trim();
    envCache.set(name, { value, time: Date.now() });
    return value;
  } catch (error) {
    envCache.set(name, { value: '', time: Date.now() });
    return '';
  }
}

function readEnvValue(name) {
  if (!name) {
    return '';
  }
  return process.env[name] || readPersistentWindowsEnv(name);
}

function getConfig() {
  const cfg = vscode.workspace.getConfiguration('ppapTab');
  const urlEnvName = cfg.get('urlEnvName', '补全url');
  const keyEnvName = cfg.get('keyEnvName', '补全key');
  const configuredBaseUrl = cfg.get('baseUrl', 'http://m.daishuge.win:8317/v1');
  const envBaseUrl = readEnvValue(urlEnvName) || readEnvValue('PPAP_COMPLETION_URL');
  return {
    enabled: cfg.get('enabled', true),
    model: cfg.get('model', 'gpt-5.3-codex-spark'),
    baseUrl: String(envBaseUrl || configuredBaseUrl).replace(/\/+$/, ''),
    urlEnvName,
    keyEnvName,
    secretEnvPath: cfg.get('secretEnvPath', 'D:\\codex\\secret\\cliproxy-image-cli.env'),
    debounceMs: cfg.get('debounceMs', 0),
    timeoutMs: cfg.get('timeoutMs', 15000),
    maxPrefixChars: cfg.get('maxPrefixChars', 12000),
    maxSuffixChars: cfg.get('maxSuffixChars', 4000),
    maxCompletionTokens: cfg.get('maxCompletionTokens', 256),
    maxCompletionChars: cfg.get('maxCompletionChars', 4000),
    includeOpenFilesContext: cfg.get('includeOpenFilesContext', true),
    maxOpenFiles: cfg.get('maxOpenFiles', 8),
    maxOpenFileChars: cfg.get('maxOpenFileChars', 4000),
    maxCacheEntries: cfg.get('maxCacheEntries', 250),
    typingReuseMs: cfg.get('typingReuseMs', 30000),
    autoTriggerAfterEdit: cfg.get('autoTriggerAfterEdit', true),
    autoTriggerAfterCursorMove: cfg.get('autoTriggerAfterCursorMove', true),
    autoTriggerDelayMs: cfg.get('autoTriggerDelayMs', 0),
    temperature: cfg.get('temperature', 0.05),
    excludePatterns: cfg.get('excludePatterns', [])
  };
}

function parseEnvFile(filePath) {
  const result = {};
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const index = trimmed.indexOf('=');
    if (index < 0) {
      continue;
    }
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function loadSecret(config) {
  const envKey = readEnvValue(config.keyEnvName) || readEnvValue('PPAP_COMPLETION_KEY') || readEnvValue('PPAP_API_KEY');
  if (envKey) {
    return envKey;
  }
  const env = parseEnvFile(config.secretEnvPath);
  return env.CLIPROXY_API_KEY || env.PPAP_API_KEY || '';
}

function prewarmEnvironmentCache() {
  const config = getConfig();
  const names = [
    config.urlEnvName,
    config.keyEnvName,
    'PPAP_COMPLETION_URL',
    'PPAP_COMPLETION_KEY',
    'PPAP_API_KEY'
  ].filter(Boolean);
  for (const name of names) {
    readEnvValue(name);
  }
  log('environment cache prewarmed');
}

function documentTextBefore(document, position, maxChars) {
  const start = new vscode.Position(0, 0);
  const text = document.getText(new vscode.Range(start, position));
  return text.length > maxChars ? text.slice(text.length - maxChars) : text;
}

function documentTextAfter(document, position, maxChars) {
  if (maxChars <= 0) {
    return '';
  }
  const end = document.positionAt(document.getText().length);
  const text = document.getText(new vscode.Range(position, end));
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

function workspaceRelativePath(document) {
  if (!document.uri.fsPath) {
    return 'untitled';
  }
  const folder = vscode.workspace.getWorkspaceFolder(document.uri);
  return folder ? path.relative(folder.uri.fsPath, document.uri.fsPath) : document.uri.fsPath;
}

function cursorWindow(document, position, linesAround = 24) {
  const start = Math.max(0, position.line - linesAround);
  const end = Math.min(document.lineCount - 1, position.line + linesAround);
  const lines = [];
  for (let lineNumber = start; lineNumber <= end; lineNumber++) {
    const line = document.lineAt(lineNumber).text;
    if (lineNumber === position.line) {
      lines.push(`${line.slice(0, position.character)}${CURSOR_MARKER}${line.slice(position.character)}`);
    } else {
      lines.push(line);
    }
  }
  return lines.join('\n');
}

function snippetText(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }
  const head = Math.floor(maxChars * 0.45);
  const tail = maxChars - head;
  return `${text.slice(0, head)}\n...\n${text.slice(text.length - tail)}`;
}

function shouldSkipDocument(document, config) {
  if (!config.enabled) {
    return true;
  }
  if (!['file', 'untitled'].includes(document.uri.scheme)) {
    return true;
  }
  const normalized = document.uri.fsPath.replace(/\\/g, '/');
  return config.excludePatterns.some((pattern) => {
    const clean = String(pattern).replace(/\\/g, '/').replace(/\*\*/g, '').replace(/\*/g, '');
    return clean && normalized.includes(clean.replace(/^\/+/, ''));
  });
}

function collectOpenFileContext(activeDocument, config) {
  if (!config.includeOpenFilesContext || config.maxOpenFiles <= 0 || config.maxOpenFileChars <= 0) {
    return '';
  }

  const seen = new Set([activeDocument.uri.toString()]);
  const candidates = [];
  for (const editor of vscode.window.visibleTextEditors) {
    if (!seen.has(editor.document.uri.toString())) {
      candidates.push(editor.document);
      seen.add(editor.document.uri.toString());
    }
  }
  for (const document of vscode.workspace.textDocuments) {
    if (!seen.has(document.uri.toString())) {
      candidates.push(document);
      seen.add(document.uri.toString());
    }
  }

  const snippets = [];
  for (const document of candidates) {
    if (snippets.length >= config.maxOpenFiles) {
      break;
    }
    if (shouldSkipDocument(document, { ...config, enabled: true })) {
      continue;
    }
    const text = document.getText();
    if (!text.trim()) {
      continue;
    }
    snippets.push([
      `<file path="${workspaceRelativePath(document)}" language="${document.languageId}">`,
      snippetText(text, config.maxOpenFileChars),
      '</file>'
    ].join('\n'));
  }
  return snippets.join('\n\n');
}

function cancellationPromise(token) {
  return new Promise((resolve) => {
    if (token.isCancellationRequested) {
      resolve(true);
      return;
    }
    const disposable = token.onCancellationRequested(() => {
      disposable.dispose();
      resolve(true);
    });
  });
}

async function sleep(ms, token) {
  if (ms <= 0) {
    return !token.isCancellationRequested;
  }
  const timeout = new Promise((resolve) => setTimeout(() => resolve(false), ms));
  const cancelled = await Promise.race([timeout, cancellationPromise(token)]);
  return !cancelled && !token.isCancellationRequested;
}

function buildPrompt(document, position, context, config) {
  const prefix = documentTextBefore(document, position, config.maxPrefixChars);
  const suffix = documentTextAfter(document, position, config.maxSuffixChars);
  const currentLine = document.lineAt(position.line).text;
  const beforeCursor = currentLine.slice(0, position.character);
  const afterCursor = currentLine.slice(position.character);
  const selectedCompletion = context?.selectedCompletionInfo?.text || '';
  const triggerKind = context?.triggerKind === vscode.InlineCompletionTriggerKind.Invoke ? 'manual' : 'automatic';
  const openFiles = collectOpenFileContext(document, config);
  const requestId = context?.requestUuid || makeRequestId();
  const messages = [
    {
      role: 'system',
      content: [
        'You are PPAP Tab, a VS Code ghost text completion engine.',
        `Predict only the exact text to insert at ${CURSOR_MARKER}.`,
        'Use the current file, suffix after the cursor, and recently viewed files as context.',
        'Do not return Markdown fences, explanations, XML tags, or code already present after the cursor.',
        'Prefer directly insertable completions, including multi-line completions when useful.',
        'Make a best-effort completion when likely helpful; return an empty string only when insertion would be harmful.'
      ].join(' ')
    },
    {
      role: 'user',
      content: [
        '<metadata>',
        `request_id: ${requestId}`,
        `language_id: ${document.languageId}`,
        `file_path: ${workspaceRelativePath(document)}`,
        `trigger_kind: ${triggerKind}`,
        `current_line_before_cursor: ${beforeCursor}`,
        `current_line_after_cursor: ${afterCursor}`,
        selectedCompletion ? `selected_completion_info: ${selectedCompletion}` : '',
        '</metadata>',
        '',
        '<recently_viewed_code_snippets>',
        openFiles || '(none)',
        '</recently_viewed_code_snippets>',
        '',
        '<current_file_cursor_window>',
        cursorWindow(document, position),
        '</current_file_cursor_window>',
        '',
        '<code_before_cursor>',
        prefix,
        '</code_before_cursor>',
        CURSOR_MARKER,
        '<code_after_cursor>',
        suffix,
        '</code_after_cursor>',
        '',
        `Return only text inserted at ${CURSOR_MARKER}.`
      ].join('\n')
    }
  ];
  return {
    messages,
    prefix,
    suffix,
    beforeCursor,
    afterCursor,
    requestId
  };
}

function maxBoundaryOverlap(left, right, limit = 240) {
  const max = Math.min(left.length, right.length, limit);
  for (let size = max; size > 0; size--) {
    if (left.endsWith(right.slice(0, size))) {
      return size;
    }
  }
  return 0;
}

function removePrefixEcho(text, prefix, beforeCursor) {
  let result = text;
  const candidates = [
    prefix.slice(Math.max(0, prefix.length - 500)),
    beforeCursor
  ].filter(Boolean);
  for (const candidate of candidates) {
    const max = Math.min(candidate.length, result.length, 300);
    for (let size = max; size >= 8; size--) {
      const tail = candidate.slice(candidate.length - size);
      if (result.startsWith(tail)) {
        result = result.slice(size);
        break;
      }
    }
  }
  return result;
}

function cleanCompletion(text, context = {}, config = getConfig()) {
  if (!text) {
    return '';
  }
  let cleaned = String(text).replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/^```[a-zA-Z0-9_-]*\n?/, '').replace(/\n?```$/, '');
  cleaned = cleaned.replace(/<\/?(PREFIX|SUFFIX|code_before_cursor|code_after_cursor|current_file_cursor_window|recently_viewed_code_snippets|metadata)>/gi, '');
  cleaned = cleaned.replace(new RegExp(CURSOR_MARKER.replace(/[|<>]/g, '\\$&'), 'g'), '');
  cleaned = cleaned.replace(/^Here is.*?:\s*/i, '');
  cleaned = cleaned.replace(/^["']{3}|["']{3}$/g, '');
  if (/^\s*<NO[_ -]?CHANGE>\s*$/i.test(cleaned) || /^\s*\(none\)\s*$/i.test(cleaned)) {
    return '';
  }
  cleaned = removePrefixEcho(cleaned, context.prefix || '', context.beforeCursor || '');
  const suffix = context.suffix || '';
  if (suffix) {
    const overlap = maxBoundaryOverlap(cleaned, suffix);
    if (overlap > 0) {
      cleaned = cleaned.slice(0, cleaned.length - overlap);
    }
  }
  cleaned = cleaned.replace(/^\s*\n+/, '');
  if (cleaned.length > config.maxCompletionChars) {
    cleaned = cleaned.slice(0, config.maxCompletionChars);
  }
  return cleaned;
}

async function callPpap(config, messages, token, cleanupContext = {}, options = {}) {
  const apiKey = loadSecret(config);
  if (!apiKey) {
    throw new Error(`No PPAP key found in ${config.secretEnvPath}`);
  }
  const abortOnCancellation = options.abortOnCancellation !== false;
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), config.timeoutMs);
  const disposable = token && abortOnCancellation
    ? token.onCancellationRequested(() => abortController.abort())
    : { dispose() {} };
  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: config.maxCompletionTokens,
        temperature: config.temperature,
        stream: false,
        stop: ['</code_before_cursor>', '</code_after_cursor>', '</current_file_cursor_window>']
      }),
      signal: abortController.signal
    });
    const bodyText = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${bodyText.slice(0, 240)}`);
    }
    const json = JSON.parse(bodyText);
    return cleanCompletion(json.choices?.[0]?.message?.content || '', cleanupContext, config);
  } finally {
    clearTimeout(timeout);
    disposable.dispose();
  }
}

class PpapInlineProvider {
  constructor() {
    this.cache = new Map();
    this.pending = new Map();
    this.current = undefined;
    this.activeTriggerTimer = undefined;
    this.retriggerTimers = new Map();
    this.stats = {
      shown: 0,
      accepted: 0,
      rejected: 0,
      ignored: 0,
      partial: 0
    };
  }

  snapshot(document, position, cacheKey) {
    return {
      documentUri: document.uri.toString(),
      version: document.version,
      cacheKey,
      position: { line: position.line, character: position.character }
    };
  }

  isSnapshotActive(snapshot) {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.uri.toString() !== snapshot.documentUri) {
      return false;
    }
    if (editor.document.version !== snapshot.version) {
      return false;
    }
    const active = editor.selection.active;
    return active.line === snapshot.position.line && active.character === snapshot.position.character;
  }

  triggerActiveInlineSoon(reason, delayMs) {
    const config = getConfig();
    if (!config.enabled) {
      return;
    }
    const editor = vscode.window.activeTextEditor;
    if (!editor || shouldSkipDocument(editor.document, config)) {
      return;
    }
    if (this.activeTriggerTimer) {
      clearTimeout(this.activeTriggerTimer);
    }
    const delay = Math.max(0, Number(delayMs ?? config.autoTriggerDelayMs) || 0);
    this.activeTriggerTimer = setTimeout(async () => {
      this.activeTriggerTimer = undefined;
      const activeEditor = vscode.window.activeTextEditor;
      if (!activeEditor || shouldSkipDocument(activeEditor.document, getConfig())) {
        return;
      }
      try {
        log(`trigger inline suggest after ${reason}`);
        await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
      } catch (error) {
        log(`trigger inline suggest failed: ${error.message || error}`);
      }
    }, delay);
  }

  scheduleRetrigger(snapshot) {
    if (!snapshot || !this.isSnapshotActive(snapshot)) {
      return;
    }
    const existing = this.retriggerTimers.get(snapshot.cacheKey);
    if (existing) {
      clearTimeout(existing);
    }
    const timer = setTimeout(async () => {
      this.retriggerTimers.delete(snapshot.cacheKey);
      if (!this.isSnapshotActive(snapshot)) {
        return;
      }
      try {
        log('completion ready after cancellation; retriggering inline suggest');
        await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
      } catch (error) {
        log(`completion retrigger failed: ${error.message || error}`);
      }
    }, 30);
    this.retriggerTimers.set(snapshot.cacheKey, timer);
  }

  rememberCache(key, completion, config) {
    if (!completion) {
      this.cache.delete(key);
      return;
    }
    this.cache.set(key, completion);
    while (this.cache.size > config.maxCacheEntries) {
      this.cache.delete(this.cache.keys().next().value);
    }
  }

  makeCacheKey(document, position, config, prompt) {
    return [
      document.uri.toString(),
      document.version,
      position.line,
      position.character,
      config.model,
      simpleHash(prompt.prefix.slice(-1000)),
      simpleHash(prompt.suffix.slice(0, 500))
    ].join(':');
  }

  makeItem(document, position, insertText, prompt, source) {
    const item = new vscode.InlineCompletionItem(insertText, new vscode.Range(position, position));
    item.__ppap = {
      id: prompt.requestId,
      source,
      documentUri: document.uri.toString(),
      position: { line: position.line, character: position.character },
      prefix: prompt.prefix,
      suffix: prompt.suffix,
      insertText,
      shownAt: Date.now()
    };
    this.current = item.__ppap;
    return item;
  }

  reuseTypingAsSuggested(document, position, config) {
    const current = this.current;
    if (!current || current.documentUri !== document.uri.toString()) {
      return undefined;
    }
    if (Date.now() - current.shownAt > config.typingReuseMs) {
      this.current = undefined;
      return undefined;
    }
    const prefix = documentTextBefore(document, position, config.maxPrefixChars);
    const suffix = documentTextAfter(document, position, config.maxSuffixChars);
    if (suffix !== current.suffix || !prefix.startsWith(current.prefix)) {
      return undefined;
    }
    const typed = prefix.slice(current.prefix.length);
    if (!typed || !current.insertText.startsWith(typed) || current.insertText.length <= typed.length) {
      return undefined;
    }
    const remaining = current.insertText.slice(typed.length);
    return {
      prompt: { ...current, prefix, suffix, requestId: current.id },
      remaining
    };
  }

  async runRequest(cacheKey, config, prompt, token) {
    const existing = this.pending.get(cacheKey);
    if (existing) {
      return existing;
    }
    const endStatus = beginStatusRequest('completion');
    const request = callPpap(config, prompt.messages, token, prompt, { abortOnCancellation: false })
      .then((completion) => {
        endStatus();
        return completion;
      })
      .catch((error) => {
        endStatus(error);
        throw error;
      })
      .finally(() => {
        this.pending.delete(cacheKey);
      });
    this.pending.set(cacheKey, request);
    return request;
  }

  async provideInlineCompletionItems(document, position, context, token) {
    const config = getConfig();
    if (shouldSkipDocument(document, config)) {
      renderStatus();
      return undefined;
    }

    const reused = this.reuseTypingAsSuggested(document, position, config);
    if (reused) {
      log(`completion reused typing-as-suggested ${document.languageId} ${reused.remaining.length} chars`);
      return { items: [this.makeItem(document, position, reused.remaining, reused.prompt, 'typing-as-suggested')] };
    }

    const prompt = buildPrompt(document, position, context, config);
    const cacheKey = this.makeCacheKey(document, position, config, prompt);
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      return cached ? { items: [this.makeItem(document, position, cached, prompt, 'cache')] } : undefined;
    }

    const okToContinue = await sleep(config.debounceMs, token);
    if (!okToContinue) {
      return undefined;
    }

    const snapshot = this.snapshot(document, position, cacheKey);
    try {
      const started = Date.now();
      const completion = await this.runRequest(cacheKey, config, prompt, token);
      this.rememberCache(cacheKey, completion, config);
      if (token.isCancellationRequested) {
        if (completion) {
          log(`completion cached after cancellation ${Date.now() - started}ms ${document.languageId} ${completion.length} chars`);
          this.scheduleRetrigger(snapshot);
        }
        return undefined;
      }
      if (!this.isSnapshotActive(snapshot)) {
        if (completion) {
          log(`completion cached for stale cursor ${Date.now() - started}ms ${document.languageId} ${completion.length} chars`);
        }
        return undefined;
      }
      if (completion) {
        log(`completion ok ${Date.now() - started}ms ${document.languageId} ${completion.length} chars`);
        return { items: [this.makeItem(document, position, completion, prompt, 'network')] };
      }
      log(`completion empty ${Date.now() - started}ms ${document.languageId}`);
      return undefined;
    } catch (error) {
      log(`completion error: ${error.message || error}`);
      return undefined;
    }
  }

  handleDidShowCompletionItem(item) {
    if (item?.__ppap) {
      this.current = item.__ppap;
      this.stats.shown += 1;
      log(`completion shown ${item.__ppap.source} ${item.__ppap.insertText.length} chars`);
    }
  }

  handleDidPartiallyAcceptCompletionItem(item, info) {
    if (item?.__ppap) {
      this.stats.partial += 1;
      const acceptedLength = typeof info === 'number' ? info : info?.acceptedLength;
      log(`completion partial accepted ${acceptedLength ?? 'unknown'} chars`);
    }
  }

  handleEndOfLifetime(item, reason) {
    if (!item?.__ppap || !reason) {
      return;
    }
    const kind = reason.kind;
    if (kind === vscode.InlineCompletionEndOfLifeReasonKind?.Accepted || kind === 0) {
      this.stats.accepted += 1;
      log(`completion accepted ${item.__ppap.insertText.length} chars`);
      return;
    }
    if (kind === vscode.InlineCompletionEndOfLifeReasonKind?.Rejected || kind === 1) {
      this.stats.rejected += 1;
      log('completion rejected');
      return;
    }
    this.stats.ignored += 1;
  }
}

async function setEnabled(enabled) {
  await vscode.workspace.getConfiguration('ppapTab').update('enabled', enabled, vscode.ConfigurationTarget.Global);
  renderStatus();
  log(`enabled=${enabled}`);
}

async function testApi() {
  const config = getConfig();
  const tokenSource = new vscode.CancellationTokenSource();
  const endStatus = beginStatusRequest('test');
  try {
    const started = Date.now();
    const completion = await callPpap(config, [
      { role: 'system', content: 'Return only the missing JavaScript expression.' },
      { role: 'user', content: 'Complete: const doubled = nums.' }
    ], tokenSource.token);
    endStatus();
    const message = `PPAP Tab test OK in ${Date.now() - started}ms: ${completion.slice(0, 80)}`;
    log(message);
    vscode.window.showInformationMessage(message);
  } catch (error) {
    endStatus(error);
    const message = `PPAP Tab test failed: ${error.message || error}`;
    log(message);
    vscode.window.showErrorMessage(message);
  } finally {
    tokenSource.dispose();
  }
}

function activate(context) {
  output = vscode.window.createOutputChannel('PPAP Tab');
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
  statusBar.command = 'ppapTab.showOutput';
  provider = new PpapInlineProvider();
  const stableInlineProvider = {
    provideInlineCompletionItems: (...args) => provider.provideInlineCompletionItems(...args)
  };

  context.subscriptions.push(output, statusBar);
  context.subscriptions.push(vscode.languages.registerInlineCompletionItemProvider({ pattern: '**' }, stableInlineProvider));
  context.subscriptions.push(vscode.commands.registerCommand('ppapTab.trigger', async () => {
    await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
  }));
  context.subscriptions.push(vscode.commands.registerCommand('ppapTab.toggle', async () => {
    await setEnabled(!getConfig().enabled);
  }));
  context.subscriptions.push(vscode.commands.registerCommand('ppapTab.test', testApi));
  context.subscriptions.push(vscode.commands.registerCommand('ppapTab.showOutput', () => output.show()));
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument((event) => {
    const config = getConfig();
    const editor = vscode.window.activeTextEditor;
    if (config.autoTriggerAfterEdit && editor && event.document.uri.toString() === editor.document.uri.toString()) {
      provider.triggerActiveInlineSoon('edit', config.autoTriggerDelayMs);
    }
  }));
  context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection((event) => {
    const config = getConfig();
    if (config.autoTriggerAfterCursorMove && event.textEditor === vscode.window.activeTextEditor) {
      provider.triggerActiveInlineSoon('cursor move', config.autoTriggerDelayMs);
    }
  }));
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration('ppapTab')) {
      renderStatus();
    }
  }));

  renderStatus();
  setTimeout(prewarmEnvironmentCache, 0);
  log('PPAP Tab activated');
}

function deactivate() {}

module.exports = { activate, deactivate };
