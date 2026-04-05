export type TrustZone = "GREEN" | "YELLOW" | "RED";

export interface TrustPolicy {
  toolName: string;
  zone: TrustZone;
  description: string;
  requiresApproval: boolean;
  provider: "github" | "slack";
}

export const DEFAULT_TRUST_POLICIES: TrustPolicy[] = [
  // GitHub tools
  {
    toolName: "list_github_issues",
    zone: "GREEN",
    description: "List open issues from a GitHub repository",
    requiresApproval: false,
    provider: "github",
  },
  {
    toolName: "list_pull_requests",
    zone: "GREEN",
    description: "List pull requests from a GitHub repository",
    requiresApproval: false,
    provider: "github",
  },
  {
    toolName: "get_issue_details",
    zone: "GREEN",
    description: "Get full details of a specific GitHub issue or PR",
    requiresApproval: false,
    provider: "github",
  },
  {
    toolName: "create_github_issue",
    zone: "GREEN",
    description: "Create a new GitHub issue",
    requiresApproval: false,
    provider: "github",
  },
  {
    toolName: "comment_on_pr",
    zone: "YELLOW",
    description: "Comment on a pull request",
    requiresApproval: false,
    provider: "github",
  },
  {
    toolName: "merge_pull_request",
    zone: "RED",
    description: "Merge a pull request into the target branch",
    requiresApproval: true,
    provider: "github",
  },

  // Slack tools
  {
    toolName: "list_slack_channels",
    zone: "GREEN",
    description: "List available Slack channels",
    requiresApproval: false,
    provider: "slack",
  },
  {
    toolName: "post_slack_message",
    zone: "GREEN",
    description: "Post a message to a Slack channel",
    requiresApproval: false,
    provider: "slack",
  },
  {
    toolName: "create_slack_channel",
    zone: "YELLOW",
    description: "Create a new Slack channel",
    requiresApproval: false,
    provider: "slack",
  },
  {
    toolName: "archive_slack_channel",
    zone: "RED",
    description: "Archive a Slack channel, making it read-only",
    requiresApproval: true,
    provider: "slack",
  },
];

export function getTrustZoneForTool(toolName: string): TrustPolicy | undefined {
  return DEFAULT_TRUST_POLICIES.find((p) => p.toolName === toolName);
}

export function getZoneColor(zone: TrustZone): string {
  switch (zone) {
    case "GREEN":
      return "#22c55e";
    case "YELLOW":
      return "#eab308";
    case "RED":
      return "#ef4444";
  }
}
