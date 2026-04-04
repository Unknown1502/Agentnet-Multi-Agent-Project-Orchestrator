import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getAccessTokenFromTokenVault } from "@auth0/ai-langchain";
import { withNotionAccess, withStepUpAuth } from "../auth0-ai";

const NOTION_VERSION = "2022-06-28";

function notionHeaders(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "Notion-Version": NOTION_VERSION,
  };
}

// GREEN — read pages the bot has been shared with
export const searchNotionPages = withNotionAccess(
  tool(
    async ({ query }: { query?: string }) => {
      const accessToken = getAccessTokenFromTokenVault();
      const body: Record<string, unknown> = { page_size: 10 };
      if (query) body.query = query;

      const response = await fetch("https://api.notion.com/v1/search", {
        method: "POST",
        headers: notionHeaders(accessToken),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return JSON.stringify({ error: `Notion API error: ${response.status}` });
      }

      const data = await response.json();
      return JSON.stringify(
        (data.results || []).map((item: Record<string, unknown>) => {
          const properties = item.properties as Record<string, Record<string, unknown>> | undefined;
          const titleProp = properties?.title ?? properties?.Name;
          const titleArr = titleProp?.title as Array<Record<string, unknown>> | undefined;
          const title = titleArr?.[0]?.plain_text ?? "(untitled)";
          return {
            id: item.id,
            type: item.object,
            title,
            url: item.url,
            last_edited: item.last_edited_time,
          };
        })
      );
    },
    {
      name: "search_notion_pages",
      description:
        "Search pages and databases in Notion that the integration has access to. Trust zone: GREEN.",
      schema: z.object({
        query: z
          .string()
          .optional()
          .describe("Optional text to search for. Omit to list all accessible pages."),
      }),
    }
  )
);

// GREEN — create a page inside a parent page or database
export const createNotionPage = withNotionAccess(
  tool(
    async ({
      parent_page_id,
      title,
      content,
    }: {
      parent_page_id: string;
      title: string;
      content?: string;
    }) => {
      const accessToken = getAccessTokenFromTokenVault();

      const children = content
        ? [
            {
              object: "block",
              type: "paragraph",
              paragraph: {
                rich_text: [{ type: "text", text: { content } }],
              },
            },
          ]
        : [];

      const response = await fetch("https://api.notion.com/v1/pages", {
        method: "POST",
        headers: notionHeaders(accessToken),
        body: JSON.stringify({
          parent: { page_id: parent_page_id },
          properties: {
            title: {
              title: [{ type: "text", text: { content: title } }],
            },
          },
          children,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        return JSON.stringify({
          error: `Notion API error: ${response.status} — ${err?.message ?? "unknown"}`,
        });
      }

      const page = await response.json();
      return JSON.stringify({ id: page.id, url: page.url, title });
    },
    {
      name: "create_notion_page",
      description: "Create a new Notion page inside a parent page. Trust zone: GREEN.",
      schema: z.object({
        parent_page_id: z
          .string()
          .describe("The ID of the parent Notion page (from search_notion_pages)"),
        title: z.string().describe("Title of the new page"),
        content: z
          .string()
          .optional()
          .describe("Optional body text for the first paragraph block"),
      }),
    }
  )
);

// YELLOW — append blocks to an existing page
export const appendNotionBlocks = withNotionAccess(
  tool(
    async ({ page_id, content }: { page_id: string; content: string }) => {
      const accessToken = getAccessTokenFromTokenVault();

      const response = await fetch(
        `https://api.notion.com/v1/blocks/${encodeURIComponent(page_id)}/children`,
        {
          method: "PATCH",
          headers: notionHeaders(accessToken),
          body: JSON.stringify({
            children: [
              {
                object: "block",
                type: "paragraph",
                paragraph: {
                  rich_text: [{ type: "text", text: { content } }],
                },
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        return JSON.stringify({ error: `Notion API error: ${response.status}` });
      }

      return JSON.stringify({ success: true, page_id });
    },
    {
      name: "append_notion_blocks",
      description:
        "Append a paragraph block to an existing Notion page. Trust zone: YELLOW.",
      schema: z.object({
        page_id: z.string().describe("The ID of the Notion page to append to"),
        content: z.string().describe("Paragraph text to append"),
      }),
    }
  )
);

// RED — archive (soft-delete) a Notion page, requires CIBA step-up
export const archiveNotionPage = withStepUpAuth(
  withNotionAccess(
    tool(
      async ({
        page_id,
        action_description,
      }: {
        page_id: string;
        action_description?: string;
      }) => {
        void action_description; // consumed by withStepUpAuth binding message
        const accessToken = getAccessTokenFromTokenVault();

        const response = await fetch(
          `https://api.notion.com/v1/pages/${encodeURIComponent(page_id)}`,
          {
            method: "PATCH",
            headers: notionHeaders(accessToken),
            body: JSON.stringify({ archived: true }),
          }
        );

        if (!response.ok) {
          return JSON.stringify({ error: `Notion API error: ${response.status}` });
        }

        return JSON.stringify({ success: true, page_id, archived: true });
      },
      {
        name: "archive_notion_page",
        description:
          "Archive (soft-delete) a Notion page. Trust zone: RED. Requires step-up authorization via CIBA push notification.",
        schema: z.object({
          page_id: z.string().describe("The ID of the Notion page to archive"),
          action_description: z
            .string()
            .optional()
            .describe("Description of the action for the step-up authorization prompt"),
        }),
      }
    )
  )
);

export const notionTools = [
  searchNotionPages,
  createNotionPage,
  appendNotionBlocks,
  archiveNotionPage,
];
