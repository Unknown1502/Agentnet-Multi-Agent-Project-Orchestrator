import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getAccessTokenFromTokenVault } from "@auth0/ai-langchain";
import { withSlackAccess, withStepUpAuth } from "../auth0-ai";

export const listSlackChannels = withSlackAccess(
  tool(
    async () => {
      const accessToken = getAccessTokenFromTokenVault();
      const response = await fetch(
        "https://slack.com/api/conversations.list?types=public_channel&limit=50",
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();
      if (!data.ok) {
        return JSON.stringify({ error: `Slack API error: ${data.error}` });
      }

      return JSON.stringify(
        data.channels.map((ch: Record<string, unknown>) => ({
          id: ch.id,
          name: ch.name,
          topic: (ch.topic as Record<string, unknown>)?.value || "",
          num_members: ch.num_members,
        }))
      );
    },
    {
      name: "list_slack_channels",
      description: "List available public Slack channels. Trust zone: GREEN.",
      schema: z.object({}),
    }
  )
);

export const postSlackMessage = withSlackAccess(
  tool(
    async ({ channel, text }: { channel: string; text: string }) => {
      const accessToken = getAccessTokenFromTokenVault();
      const response = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel, text }),
      });

      const data = await response.json();
      if (!data.ok) {
        return JSON.stringify({ error: `Slack API error: ${data.error}` });
      }

      return JSON.stringify({
        channel: data.channel,
        ts: data.ts,
        message: "Message posted successfully",
      });
    },
    {
      name: "post_slack_message",
      description: "Post a message to a Slack channel. Trust zone: GREEN.",
      schema: z.object({
        channel: z.string().describe("The channel ID or name to post to"),
        text: z.string().describe("The message text to send"),
      }),
    }
  )
);

export const createSlackChannel = withSlackAccess(
  tool(
    async ({ name, is_private }: { name: string; is_private?: boolean }) => {
      const accessToken = getAccessTokenFromTokenVault();
      const response = await fetch(
        "https://slack.com/api/conversations.create",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name, is_private: is_private || false }),
        }
      );

      const data = await response.json();
      if (!data.ok) {
        return JSON.stringify({ error: `Slack API error: ${data.error}` });
      }

      return JSON.stringify({
        id: data.channel.id,
        name: data.channel.name,
        created: data.channel.created,
      });
    },
    {
      name: "create_slack_channel",
      description:
        "Create a new Slack channel. Trust zone: YELLOW.",
      schema: z.object({
        name: z
          .string()
          .describe("The name of the channel to create (lowercase, no spaces)"),
        is_private: z
          .boolean()
          .optional()
          .describe("Whether to create a private channel"),
      }),
    }
  )
);

export const archiveSlackChannel = withStepUpAuth(
  withSlackAccess(
    tool(
      async ({ channel_id, action_description }: { channel_id: string; action_description?: string }) => {
        void action_description; // consumed by withStepUpAuth binding message
        const accessToken = getAccessTokenFromTokenVault();
        const response = await fetch("https://slack.com/api/conversations.archive", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ channel: channel_id }),
        });

        const data = await response.json();
        if (!data.ok) {
          return JSON.stringify({ error: `Slack API error: ${data.error}` });
        }

        return JSON.stringify({ success: true, channel_id, archived: true });
      },
      {
        name: "archive_slack_channel",
        description:
          "Archive a Slack channel, making it read-only. Trust zone: RED. Requires step-up authorization via CIBA push notification.",
        schema: z.object({
          channel_id: z.string().describe("The ID of the Slack channel to archive"),
          action_description: z
            .string()
            .optional()
            .describe("Description of the action for the step-up authorization prompt"),
        }),
      }
    )
  )
);

export const slackTools = [
  listSlackChannels,
  postSlackMessage,
  createSlackChannel,
  archiveSlackChannel,
];
