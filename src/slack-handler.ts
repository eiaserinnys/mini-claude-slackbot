import type { App } from "@slack/bolt";
import { runClaudeQuery, setCwd, getCwd } from "./claude.js";

// Track in-flight requests so we can cancel if user sends a new message in the same thread
const activeRequests = new Map<string, AbortController>();

function getThreadKey(channel: string, threadTs?: string, ts?: string): string {
  return `${channel}:${threadTs || ts}`;
}

function cancelPrevious(threadKey: string): AbortController {
  const prev = activeRequests.get(threadKey);
  if (prev) prev.abort();
  const controller = new AbortController();
  activeRequests.set(threadKey, controller);
  return controller;
}

async function handleMessage(
  app: App,
  text: string,
  channel: string,
  threadTs: string,
  channelOrDm: string,
): Promise<void> {
  const trimmed = text.trim();

  // Handle cwd command
  const cwdMatch = trimmed.match(/^cwd\s*(.*)/i);
  if (cwdMatch) {
    const path = cwdMatch[1].trim();
    if (path) {
      setCwd(channelOrDm, path);
      await app.client.chat.postMessage({
        channel,
        thread_ts: threadTs,
        text: `✅ 작업 디렉토리 설정: \`${path}\``,
      });
    } else {
      const current = getCwd(channelOrDm);
      await app.client.chat.postMessage({
        channel,
        thread_ts: threadTs,
        text: current
          ? `📁 현재 작업 디렉토리: \`${current}\``
          : "📁 작업 디렉토리가 설정되지 않았습니다. `cwd /path/to/project` 로 설정하세요.",
      });
    }
    return;
  }

  const threadKey = getThreadKey(channel, threadTs);
  const controller = cancelPrevious(threadKey);

  // Post initial "thinking" message
  const statusMsg = await app.client.chat.postMessage({
    channel,
    thread_ts: threadTs,
    text: "🤔 생각 중...",
  });

  const statusTs = statusMsg.ts!;
  const toolActions: string[] = [];

  const updateStatus = async (text: string) => {
    try {
      await app.client.chat.update({ channel, ts: statusTs, text });
    } catch {
      // Ignore update errors (message may have been deleted)
    }
  };

  await runClaudeQuery(
    threadKey,
    channelOrDm,
    trimmed,
    {
      onToolUse: (description) => {
        toolActions.push(description);
        const lines = toolActions.slice(-5).join("\n");
        updateStatus(`⏳ 작업 중...\n${lines}`);
      },
      onResult: async (resultText, cost) => {
        activeRequests.delete(threadKey);
        // Post the result as a new message in the thread
        const costInfo = cost > 0 ? `\n\n_💰 ${cost.toFixed(4)} USD_` : "";
        await app.client.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: resultText + costInfo,
        });
        await updateStatus("✅ 완료");
      },
      onError: async (error) => {
        activeRequests.delete(threadKey);
        await app.client.chat.postMessage({
          channel,
          thread_ts: threadTs,
          text: `❌ 오류 발생:\n\`\`\`${error}\`\`\``,
        });
        await updateStatus("❌ 오류");
      },
    },
    controller,
  );
}

export function registerHandlers(app: App, botUserId: string): void {
  // Handle direct messages
  app.message(async ({ message }) => {
    const msg = message as unknown as Record<string, unknown>;

    // Ignore bot messages and message_changed events
    if (msg.subtype || msg.bot_id) return;
    if (!msg.text || typeof msg.text !== "string") return;

    const channel = msg.channel as string;
    const threadTs = (msg.thread_ts || msg.ts) as string;
    await handleMessage(app, msg.text, channel, threadTs, channel);
  });

  // Handle @mentions in channels
  app.event("app_mention", async ({ event }) => {
    // Strip the bot mention from text
    const text = event.text.replace(new RegExp(`<@${botUserId}>`, "g"), "").trim();
    if (!text) return;

    const threadTs = event.thread_ts || event.ts;
    await handleMessage(app, text, event.channel, threadTs, event.channel);
  });
}
