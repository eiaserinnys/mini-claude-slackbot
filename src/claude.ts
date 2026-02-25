import { query, type SDKMessage } from "@anthropic-ai/claude-code";

interface Session {
  sessionId: string;
  cwd: string;
  lastUsed: number;
}

const sessions = new Map<string, Session>();
const cwdSettings = new Map<string, string>();

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Clean up stale sessions periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessions) {
    if (now - session.lastUsed > SESSION_TTL_MS) {
      sessions.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function setCwd(channelOrDm: string, cwd: string): void {
  cwdSettings.set(channelOrDm, cwd);
}

export function getCwd(channelOrDm: string): string | undefined {
  return cwdSettings.get(channelOrDm);
}

const TOOL_ICONS: Record<string, string> = {
  Read: "📖 파일 읽기",
  Edit: "📝 파일 편집",
  Write: "📝 파일 작성",
  Bash: "🖥️ 명령 실행",
  Glob: "🔍 파일 검색",
  Grep: "🔍 내용 검색",
  Task: "🧵 하위 작업",
  WebFetch: "🌐 웹 조회",
  WebSearch: "🌐 웹 검색",
};

function formatToolUse(toolName: string, input?: unknown): string {
  const icon = TOOL_ICONS[toolName] || `🔧 ${toolName}`;
  if (toolName === "Bash" && input && typeof input === "object" && "command" in input) {
    const cmd = String((input as { command: string }).command);
    const short = cmd.length > 80 ? cmd.slice(0, 80) + "..." : cmd;
    return `${icon}: \`${short}\``;
  }
  if (toolName === "Read" && input && typeof input === "object" && "file_path" in input) {
    return `${icon}: \`${(input as { file_path: string }).file_path}\``;
  }
  if ((toolName === "Edit" || toolName === "Write") && input && typeof input === "object" && "file_path" in input) {
    return `${icon}: \`${(input as { file_path: string }).file_path}\``;
  }
  return icon;
}

export interface StreamCallbacks {
  onToolUse: (description: string) => void;
  onResult: (text: string, cost: number) => void;
  onError: (error: string) => void;
}

export async function runClaudeQuery(
  threadKey: string,
  channelOrDm: string,
  prompt: string,
  callbacks: StreamCallbacks,
  abortController?: AbortController,
): Promise<void> {
  const existing = sessions.get(threadKey);
  const cwd = getCwd(channelOrDm) || process.cwd();

  try {
    const conversation = query({
      prompt,
      options: {
        cwd,
        resume: existing?.sessionId,
        permissionMode: "bypassPermissions",
        maxTurns: 20,
        appendSystemPrompt: "You are a helpful Slack bot assistant. Keep responses concise and well-formatted for Slack. Use Slack mrkdwn syntax (not GitHub markdown).",
        abortController,
      },
    });

    let sessionId: string | undefined;

    for await (const message of conversation) {
      if (abortController?.signal.aborted) break;

      if (message.type === "system" && message.subtype === "init") {
        sessionId = message.session_id;
      }

      if (message.type === "assistant" && message.message?.content) {
        for (const block of message.message.content) {
          if (block.type === "tool_use") {
            callbacks.onToolUse(formatToolUse(block.name, block.input));
          }
        }
      }

      if (message.type === "result") {
        if (message.subtype === "success") {
          callbacks.onResult(message.result, message.total_cost_usd);
        } else {
          callbacks.onError(`Error: ${message.subtype}`);
        }
      }
    }

    if (sessionId) {
      sessions.set(threadKey, { sessionId, cwd, lastUsed: Date.now() });
    }
  } catch (err) {
    if (abortController?.signal.aborted) return;
    callbacks.onError(err instanceof Error ? err.message : String(err));
  }
}
