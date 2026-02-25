import "dotenv/config";
import { App } from "@slack/bolt";
import { registerHandlers } from "./slack-handler.js";

async function main() {
  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
  });

  // Get the bot's own user ID for stripping mentions
  const authResult = await app.client.auth.test();
  const botUserId = authResult.user_id!;
  console.log(`Bot user ID: ${botUserId}`);

  registerHandlers(app, botUserId);

  await app.start();
  console.log("⚡ Mini Claude Slack Bot is running!");
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
