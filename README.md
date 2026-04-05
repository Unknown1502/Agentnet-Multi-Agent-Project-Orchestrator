# AgentNet — Multi-Agent Project Orchestrator

A hackathon submission for **Authorized to Act: Auth0 for AI Agents** demonstrating cascading trust delegation across GitHub and Slack using Auth0 Token Vault, CIBA step-up authorization, and a LangGraph-based multi-agent orchestration system.

## Architecture

```
User (Natural Language Command)
       |
  [Next.js API — SSE Stream]
       |
  [Orchestrator Agent] — Llama 3.3 70b (Groq)
       |  parses intent, builds task plan
       |
  +-------------+-------------+
  |             |
[GitHub Agent] [Slack Agent]
  |             |
  GitHub tools  Slack tools
  |             |
  +-------------+
       |
  [Auth0 Token Vault — Federated Token Exchange]
  (each agent fetches its own short-lived provider token)
       |
  [CIBA Step-Up Auth] — RED zone actions (merge PR, archive, etc.)
       |
  [Orchestrator Synthesizer] — merges results, streams final response
       |
  [SSE Response → UI]
```

### Auth0 Integration Points

1. **Authentication**: `@auth0/nextjs-auth0` v4 — middleware-based session management, refresh tokens via `offline_access` scope
2. **Token Vault**: Federated token exchange (`grant_type: federated-connection-access-token`) for GitHub and Slack OAuth tokens via `@auth0/ai-langchain`
3. **CIBA (Client Initiated Backchannel Authentication)**: Step-up authorization for high-risk RED zone actions (merge PR, archive channels, etc.)
4. **Trust Zones**: Configurable GREEN / YELLOW / RED risk levels per agent tool, stored in Redis with in-memory fallback

### Token Flow

```
User Session (Auth0 Refresh Token at session.tokenSet.refreshToken)
    → Token Exchange (M2M client + federated-connection grant)
    → Provider Access Token (GitHub / Slack)
    → Agent Tool Execution (least-privilege, scoped per sub-agent)
```

## Tech Stack

- **Framework**: Next.js 16 (App Router, TypeScript, Turbopack)
- **Auth**: `@auth0/nextjs-auth0` v4, `@auth0/ai-langchain` v5, `@auth0/ai` v6
- **AI / LLM**: Groq — `llama-3.3-70b-versatile` (free tier, tool-calling capable)
- **Orchestration**: LangGraph `StateGraph` — orchestrator + 2 isolated sub-agents
- **Database**: SQLite (`better-sqlite3`) for audit trail; Upstash Redis for caching
- **UI**: Tailwind CSS v4, Lucide Icons — dark cyan/violet theme

## Prerequisites

- Node.js 18+
- Auth0 tenant with:
  - Regular Web Application (Authorization Code + Refresh Token grants)
  - Machine-to-Machine app for Token Vault (Token Vault grant enabled)
  - Social connections: GitHub, Slack (`sign-in-with-slack`)
  - CIBA / Guardian enabled for step-up authorization
- Groq API key (free — no credit card required at [console.groq.com](https://console.groq.com))
- _(Optional)_ Upstash Redis for persistent audit logs and trust policy caching

## Setup

### 1. Clone and Install

```bash
cd agentnet
npm install --legacy-peer-deps
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `AUTH0_SECRET` | Random 32+ character string for session encryption |
| `AUTH0_BASE_URL` | Your app URL — `http://localhost:3000` |
| `AUTH0_DOMAIN` | Auth0 domain — `dev-xxx.us.auth0.com` |
| `AUTH0_ISSUER_BASE_URL` | `https://dev-xxx.us.auth0.com` |
| `AUTH0_CLIENT_ID` | Regular Web App client ID |
| `AUTH0_CLIENT_SECRET` | Regular Web App client secret |
| `AUTH0_AUDIENCE` | API audience (e.g. Management API URL) |
| `AUTH0_SCOPE` | `openid profile email offline_access` |
| `AUTH0_TOKEN_VAULT_CLIENT_ID` | Token Vault M2M app client ID |
| `AUTH0_TOKEN_VAULT_CLIENT_SECRET` | Token Vault M2M app client secret |
| `GROQ_API_KEY` | Groq API key from [console.groq.com](https://console.groq.com) |
| `GROQ_MODEL` | `llama-3.3-70b-versatile` (or any Groq tool-calling model) |
| `UPSTASH_REDIS_REST_URL` | _(Optional)_ Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | _(Optional)_ Upstash Redis REST token |

### 3. Auth0 Configuration

#### Regular Web Application

- **Application Type**: Regular Web Application
- **Allowed Callback URLs**: `http://localhost:3000/auth/callback`
- **Allowed Logout URLs**: `http://localhost:3000`
- **Grant Types**: Authorization Code, Refresh Token
- **Scopes**: ensure `offline_access` is allowed (required for refresh tokens → Token Vault)

#### Token Vault M2M Application

- **Application Type**: Machine to Machine
- **Grant Types**: Client Credentials + **Token Vault** (must be explicitly enabled)
- Authorize against the **Auth0 Token Vault API** audience

#### Social Connections

Enable in **Auth0 Dashboard → Authentication → Social**:

| Connection | Auth0 name | Required scopes |
|---|---|---|
| GitHub | `github` | `repo`, `read:org`, `read:user` |
| Slack | `sign-in-with-slack` | `chat:write`, `channels:read`, `channels:manage`, `users:read` |

Both connections must be enabled on **both** the Regular Web App and the Token Vault M2M app.

#### CIBA / Step-Up Auth

1. Enable **Auth0 Guardian** in Dashboard → Security → Multi-factor Auth
2. Enable **Push Notifications** and install the Guardian app on your device
3. CIBA is triggered automatically for RED zone tool calls (merge PR, archive channel, etc.)

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Trust Zones

| Zone | Behavior | Examples |
|---|---|---|
| GREEN | Auto-approved, logged | List issues, list channels, post messages |
| YELLOW | Logged with full audit | Comment on PR, create issue, create Slack channel |
| RED | Requires CIBA step-up push notification | Merge PR, archive Slack channel |

Trust zones are configurable per tool in the **Trust Configuration** dashboard.

## Project Structure

```
src/
  app/
    api/
      agent/execute/    # SSE agent execution endpoint (orchestrator entry)
      audit/            # Audit log API (SQLite + Redis)
      trust/            # Trust policy read/write API
      connections/      # Connection status probe + OAuth initiation
    dashboard/
      page.tsx          # Main command center + live activity feed
      connections/      # OAuth connection management (GitHub/Slack)
      audit/            # Audit trail viewer
      trust/            # Trust zone configuration
    page.tsx            # Landing / sign-in page
  components/
    ui/                 # Base UI components (Button, Card, Badge, Input)
    command-input.tsx   # Natural language command input
    agent-activity-feed.tsx  # Real-time SSE event stream display
    connection-card.tsx      # Per-provider connection card
    trust-zone-badge.tsx     # GREEN/YELLOW/RED zone indicator
    step-up-notification.tsx # CIBA push notification banner
    audit-log-table.tsx      # Audit log display
    nav-sidebar.tsx          # Navigation sidebar
  lib/
    auth0.ts            # Auth0Client initialization (nextjs-auth0 v4)
    auth0-ai.ts         # Token Vault wrappers (withGitHubAccess, withSlackAccess)
    token-vault.ts      # session.tokenSet.refreshToken extraction helper
    trust-policy.ts     # Trust zone definitions per tool
    session.ts          # Session helper utilities
    db.ts               # SQLite + Upstash Redis setup
    utils.ts            # Shared utility functions
    agent/
      graph.ts          # Orchestrator LangGraph StateGraph
      state.ts          # Agent state types and event types
      sub-agents.ts     # GitHub / Slack isolated sub-agents
    tools/
      github-tools.ts   # GitHub tools: list issues, create issue, list PRs, merge PR
      slack-tools.ts    # Slack tools: list channels, post message, create/archive channel
  proxy.ts              # Auth0 middleware + route protection
```

## Demo Scenario

1. **Connect accounts** — link GitHub and Slack via Auth0 Token Vault (OAuth flow per provider)
2. **Issue a command** — e.g. *"Create a GitHub issue for the login bug and post about it in #engineering on Slack"*
3. **Watch the agents** — Orchestrator delegates to GitHub and Slack sub-agents in parallel; GREEN/YELLOW actions execute automatically
4. **Step-up auth** — RED zone actions (merge PR, archive channel) trigger a CIBA push notification on your Guardian app
5. **Audit trail** — every action is logged with user, provider, trust zone, and timestamp

## Security Model

- User credentials never reach the AI agent
- Each sub-agent operates with **least-privilege** — isolated tool sets, no cross-agent token sharing
- Token Vault manages federated token lifecycle; tokens are never stored in the agent state
- Refresh tokens enable scoped, time-limited provider access
- CIBA provides out-of-band authorization for destructive actions
- Full audit trail stored in SQLite (persisted) with Redis caching layer

## License

MIT
