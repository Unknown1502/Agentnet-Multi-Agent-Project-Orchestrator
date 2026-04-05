import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { getAccessTokenFromTokenVault } from "@auth0/ai-langchain";
import { withGitHubAccess, withStepUpAuth } from "../auth0-ai";

export const listGitHubIssues = withGitHubAccess(
  tool(
    async ({ owner, repo }: { owner: string; repo: string }) => {
      const accessToken = getAccessTokenFromTokenVault();
      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=open&per_page=10`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (!response.ok) {
        return JSON.stringify({ error: `GitHub API error: ${response.status}` });
      }

      const issues = await response.json();
      return JSON.stringify(
        issues.map((i: Record<string, unknown>) => ({
          number: i.number,
          title: i.title,
          state: i.state,
          labels: (i.labels as Array<Record<string, unknown>>)?.map((l) => l.name),
          assignee: (i.assignee as Record<string, unknown>)?.login || null,
          created_at: i.created_at,
        }))
      );
    },
    {
      name: "list_github_issues",
      description: "List open issues from a GitHub repository. Returns issue number, title, state, labels, and assignee.",
      schema: z.object({
        owner: z.string().describe("The repository owner (user or organization)"),
        repo: z.string().describe("The repository name"),
      }),
    }
  )
);

export const createGitHubIssue = withGitHubAccess(
  tool(
    async ({ owner, repo, title, body, labels }: { owner: string; repo: string; title: string; body?: string; labels?: string[] }) => {
      const accessToken = getAccessTokenFromTokenVault();
      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title, body, labels }),
        }
      );

      if (!response.ok) {
        return JSON.stringify({ error: `GitHub API error: ${response.status}` });
      }

      const issue = await response.json();
      return JSON.stringify({
        number: issue.number,
        title: issue.title,
        html_url: issue.html_url,
        state: issue.state,
      });
    },
    {
      name: "create_github_issue",
      description: "Create a new issue in a GitHub repository. Trust zone: GREEN.",
      schema: z.object({
        owner: z.string().describe("The repository owner"),
        repo: z.string().describe("The repository name"),
        title: z.string().describe("The issue title"),
        body: z.string().optional().describe("The issue body in markdown"),
        labels: z.array(z.string()).optional().describe("Labels to apply to the issue"),
      }),
    }
  )
);

export const commentOnPR = withGitHubAccess(
  tool(
    async ({ owner, repo, pull_number, body }: { owner: string; repo: string; pull_number: number; body: string }) => {
      const accessToken = getAccessTokenFromTokenVault();
      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${pull_number}/comments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ body }),
        }
      );

      if (!response.ok) {
        return JSON.stringify({ error: `GitHub API error: ${response.status}` });
      }

      const comment = await response.json();
      return JSON.stringify({
        id: comment.id,
        html_url: comment.html_url,
        created_at: comment.created_at,
      });
    },
    {
      name: "comment_on_pr",
      description: "Add a comment to a pull request. Trust zone: YELLOW.",
      schema: z.object({
        owner: z.string().describe("The repository owner"),
        repo: z.string().describe("The repository name"),
        pull_number: z.number().describe("The pull request number"),
        body: z.string().describe("The comment body in markdown"),
      }),
    }
  )
);

export const mergePullRequest = withStepUpAuth(
  withGitHubAccess(
    tool(
      async ({ owner, repo, pull_number, commit_title, merge_method }: { owner: string; repo: string; pull_number: number; commit_title?: string; merge_method?: string }) => {
        const accessToken = getAccessTokenFromTokenVault();
        const response = await fetch(
          `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${pull_number}/merge`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/vnd.github.v3+json",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              commit_title,
              merge_method: merge_method || "squash",
            }),
          }
        );

        if (!response.ok) {
          const err = await response.json();
          return JSON.stringify({ error: `Merge failed: ${err.message}` });
        }

        const result = await response.json();
        return JSON.stringify({
          merged: result.merged,
          message: result.message,
          sha: result.sha,
        });
      },
      {
        name: "merge_pull_request",
        description:
          "Merge a pull request. Trust zone: RED. Requires step-up authorization via CIBA push notification.",
        schema: z.object({
          owner: z.string().describe("The repository owner"),
          repo: z.string().describe("The repository name"),
          pull_number: z.number().describe("The pull request number"),
          commit_title: z.string().optional().describe("Custom merge commit title"),
          merge_method: z
            .enum(["merge", "squash", "rebase"])
            .optional()
            .describe("The merge method to use"),
          action_description: z
            .string()
            .optional()
            .describe("Description of the action for step-up authorization prompt"),
        }),
      }
    )
  )
);

export const listPullRequests = withGitHubAccess(
  tool(
    async ({ owner, repo, state }: { owner: string; repo: string; state?: string }) => {
      const accessToken = getAccessTokenFromTokenVault();
      const params = new URLSearchParams({
        state: state || "open",
        per_page: "10",
      });
      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls?${params}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (!response.ok) {
        return JSON.stringify({ error: `GitHub API error: ${response.status}` });
      }

      const prs = await response.json();
      return JSON.stringify(
        prs.map((pr: Record<string, unknown>) => ({
          number: pr.number,
          title: pr.title,
          state: pr.state,
          draft: pr.draft,
          user: (pr.user as Record<string, unknown>)?.login,
          head: (pr.head as Record<string, unknown>)?.ref,
          base: (pr.base as Record<string, unknown>)?.ref,
          created_at: pr.created_at,
          html_url: pr.html_url,
        }))
      );
    },
    {
      name: "list_pull_requests",
      description:
        "List pull requests from a GitHub repository. Trust zone: GREEN.",
      schema: z.object({
        owner: z.string().describe("The repository owner"),
        repo: z.string().describe("The repository name"),
        state: z
          .enum(["open", "closed", "all"])
          .optional()
          .describe("Filter by state (default: open)"),
      }),
    }
  )
);

export const getIssueDetails = withGitHubAccess(
  tool(
    async ({ owner, repo, issue_number }: { owner: string; repo: string; issue_number: number }) => {
      const accessToken = getAccessTokenFromTokenVault();
      const response = await fetch(
        `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues/${issue_number}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (!response.ok) {
        return JSON.stringify({ error: `GitHub API error: ${response.status}` });
      }

      const issue = await response.json();
      return JSON.stringify({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        body: (issue.body as string)?.slice(0, 500),
        labels: (issue.labels as Array<Record<string, unknown>>)?.map((l) => l.name),
        assignees: (issue.assignees as Array<Record<string, unknown>>)?.map((a) => a.login),
        comments: issue.comments,
        created_at: issue.created_at,
        html_url: issue.html_url,
      });
    },
    {
      name: "get_issue_details",
      description:
        "Get full details of a specific GitHub issue or pull request. Trust zone: GREEN.",
      schema: z.object({
        owner: z.string().describe("The repository owner"),
        repo: z.string().describe("The repository name"),
        issue_number: z.number().describe("The issue or PR number"),
      }),
    }
  )
);

export const listUserRepos = withGitHubAccess(
  tool(
    async ({ sort, limit }: { sort?: string; limit?: number }) => {
      const accessToken = getAccessTokenFromTokenVault();
      const params = new URLSearchParams({
        sort: sort || "pushed",
        per_page: String(limit || 10),
        affiliation: "owner",
      });
      const response = await fetch(
        `https://api.github.com/user/repos?${params}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/vnd.github.v3+json",
          },
        }
      );

      if (!response.ok) {
        return JSON.stringify({ error: `GitHub API error: ${response.status}` });
      }

      const repos = await response.json();
      return JSON.stringify(
        (repos as Array<Record<string, unknown>>).map((r) => ({
          owner: (r.owner as Record<string, unknown>)?.login,
          repo: r.name,
          full_name: r.full_name,
          description: r.description,
          private: r.private,
          pushed_at: r.pushed_at,
          open_issues_count: r.open_issues_count,
        }))
      );
    },
    {
      name: "list_user_repos",
      description:
        "List the authenticated user's own GitHub repositories. Call this FIRST when the user does not specify a repository name so you can discover the correct owner and repo to use.",
      schema: z.object({
        sort: z
          .enum(["created", "updated", "pushed", "full_name"])
          .optional()
          .describe("Sort order (default: pushed — most recently active first)"),
        limit: z
          .number()
          .optional()
          .describe("Max repos to return (default: 10)"),
      }),
    }
  )
);

export const githubTools = [
  listUserRepos,
  listGitHubIssues,
  listPullRequests,
  getIssueDetails,
  createGitHubIssue,
  commentOnPR,
  mergePullRequest,
];
