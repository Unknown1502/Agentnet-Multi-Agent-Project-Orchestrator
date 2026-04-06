# AgentNet — DevPost Submission
### Hackathon: Authorized to Act: Auth0 for AI Agents

---

## Tagline

> **Cascading trust delegation for AI agents — a multi-agent system that proves every action with cryptographic identity, not just credentials.**

---

## Inspiration

The rise of agentic AI has created a paradox: the more capable an AI agent becomes, the more dangerous an unchecked one is. Today's AI systems are given a single long-lived OAuth token and told "do whatever the user asked." There is no concept of *who* is asking, *why* they're allowed to act, or *how risky* the action is.

We wanted to answer a simple but hard question:

> *What does it actually look like to build an AI agent that earns the right to act — at every step, for every tool?*

Auth0's new AI-native suite (`@auth0/ai-langchain`, Token Vault, CIBA) gave us the building blocks. AgentNet is our answer: a production-grade multi-agent orchestration system where **authorization is a first-class citizen, not an afterthought**.

---

## What It Does

AgentNet is a natural-language command center for GitHub and Slack — powered by a multi-agent AI system that enforces identity-based authorization at every tool call.

You type a single instruction:

> *"List open issues, comment on the most critical PR, then post a sprint summary to #engineering."*

AgentNet decomposes it into a task plan, delegates to specialized sub-agents (GitHub Agent, Slack Agent), and streams every step live — while Auth0 enforces trust at each action boundary.

### Core Capabilities

**1. Multi-Agent Orchestration**
- An **Orchestrator Agent** (Llama 3.3 70B via Groq) parses the user's intent and generates a structured task plan via tool-calling.
- Specialized **sub-agents** (GitHub, Slack) each run an isolated ReAct loop — they have no knowledge of each other's tools, credentials, or context.
- Agents run in parallel where the plan allows, or sequentially when dependencies require it.

**2. Trust Zone System (GREEN / YELLOW / RED)**
- Every tool in the system is classified into a trust zone:
  - **GREEN** — read-only, zero side-effects (list repos, list issues, list channels)
  - **YELLOW** — low-risk mutations (create issue, comment on PR, create channel)
  - **RED** — irreversible / high-blast-radius (merge PR, archive Slack channel)
- Trust zone metadata is visible in real-time in the UI and logged to the audit trail.

**3. Auth0 Token Vault — Federated Token Exchange**
- Each sub-agent fetches its own **short-lived, scoped access token** from Auth0's Management API at the moment it needs it — not before.
- Tokens are never stored in application state or passed between agents. The GitHub Agent cannot touch Slack credentials; the Slack Agent cannot touch GitHub credentials.
- This is implemented via `@auth0/ai-langchain`'s `withTokenVault` wrapper: every tool call is intercepted by an Auth0-managed token resolution layer before execution.

**4. CIBA Step-Up Authorization**
- RED zone actions (e.g., `merge_pull_request`, `archive_slack_channel`) do not execute automatically.
- AgentNet calls `withAsyncAuthorization` (CIBA — Client Initiated Backchannel Authentication): Auth0 sends an **out-of-band push notification** to the user's device via Guardian.
- The agent's execution stream is interrupted and paused. The user approves on their phone. Only then does the merge proceed.
- The binding message displayed on the notification is dynamically generated from the actual action parameters.

**5. Complete Audit Trail**
- Every tool invocation is logged to SQLite with: user ID, agent ID, tool name, provider, trust zone, status, and result snippet.
- The audit page provides filterable, real-time log views by provider and trust zone.
- Optional Upstash Redis caching keeps the audit endpoint fast under load.

**6. Live SSE Activity Stream**
- The entire agent execution is streamed to the browser via Server-Sent Events.
- Users see exactly which agent is thinking, which tool is being called, what trust zone it falls under, and whether step-up is required — all in real time.
- Completed runs can be **replayed** frame-by-frame to walk through the trust decision chain.

**7. Social Connection Management**
- A dedicated Connections page lets users link/unlink GitHub and Slack social accounts via Auth0's account-linking flow.
- Connection status is checked against the Auth0 Management API (ground truth) with Redis-cached fallbacks.

---

## How We Built It

### Architecture

```
User (Natural Language Command)
        │
   [Next.js API — SSE Stream]
        │
   [Orchestrator Agent]  — Llama 3.3 70B (Groq)
        │   parses intent, builds JSON task plan via tool-calling
        │
   ┌────┴────┐
   │         │
[GitHub    [Slack
 Agent]     Agent]
   │         │
 GitHub    Slack
 Tools     Tools
   │         │
   └────┬────┘
        │
[Auth0 Token Vault — per-agent federated token resolution]
        │
[CIBA Step-Up] — for RED zone actions only
        │
[Orchestrator Synthesizer] — merges results, writes final prose response
        │
[SSE → UI — live trust event stream]
```

### Auth0 Integration — Deep Dive

**Authentication Layer**
`@auth0/nextjs-auth0` v4 handles the full auth lifecycle: Authorization Code Flow, refresh token rotation via `offline_access`, and middleware-based session management across all API routes. The refresh token is threaded through the LangGraph config so the Token Vault layer can exchange it for provider-specific access tokens.

**Token Vault (Federated Connection Access Tokens)**
We wrap every tool with `auth0AI.withTokenVault({ connection, scopes, accessToken: resolver })`. The resolver calls Auth0's Management API (`GET /api/v2/users/{id}`) with an M2M client to retrieve the identity-linked provider token at call time. This means:
- Each agent only ever has a token for its own provider.
- Tokens are fetched on-demand, not stored in memory between requests.
- The M2M client needs exactly `read:users` + `read:user_idp_tokens` — scoped to minimum required permissions.

**CIBA / Step-Up Authorization**
RED zone tools are wrapped in `auth0AI.withAsyncAuthorization()`. When the GitHub Agent tries to call `merge_pull_request`, the LangGraph runtime throws a `GraphInterrupt`. We catch it in the SSE handler, emit a structured `interrupt` event to the browser, and serialize the pending state. The UI shows a step-up notification with the binding message. Upon user approval via Auth0 Guardian, the client re-submits the same prompt with the paused thread ID, and execution resumes.

**Account Linking**
The `/api/auth/[provider]` route initiates a connection flow with `connection` and `access_type=link` query parameters. After the OAuth callback, Auth0 links the social identity to the primary user, and we set a Redis marker as a write-through cache. The connection status page queries the Management API as the ground truth source.

### Agent Design — Least Privilege

Each sub-agent is defined by:
- An isolated tool set (GitHub Agent cannot see Slack tools, and vice versa)
- A scoped system prompt that explicitly tells the agent it cannot access other providers
- Its own Token Vault credential resolver

The orchestrator is a **pure planner** — it has no access to provider tools whatsoever. It can only call `delegate_tasks` to produce a JSON plan. Execution authority exists only at the sub-agent level.

### Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript, Turbopack) |
| AI / LLM | Groq — `llama-3.3-70b-versatile` (free, tool-calling) |
| Orchestration | LangGraph `StateGraph` — orchestrator + isolated sub-agents |
| Auth | `@auth0/nextjs-auth0` v4, `@auth0/ai-langchain` v5, `@auth0/ai` v6 |
| Provider APIs | `@octokit/rest`, `@slack/web-api` |
| Database | `better-sqlite3` (audit trail), Upstash Redis (caching) |
| UI | Tailwind CSS v4, Framer Motion, Lucide Icons |
| Hosting | Vercel (SSE streaming, edge-compatible) |

---

## Challenges We Ran Into

**1. Token Vault on Free-Tier Auth0 Tenants**
The `grant_type: federated-connection-access-token` Token Exchange grant requires a paid Auth0 plan. We needed a strategy that worked identically from the agent's perspective but fell back to the Management API's `read:user_idp_tokens` permission for free-tier tenants. We built a resolver shim inside `withTokenVault`'s `accessToken` callback that transparently fetches identity-linked tokens from the Management API — so the agent code never changes, and the auth plumbing is swappable.

**2. CIBA Interrupt ↔ SSE State Continuity**
LangGraph's `GraphInterrupt` suspends execution inside a tool call mid-stream. Re-hydrating that state when the user approves in Auth0 Guardian and the client re-submits required threading the `thread_id` through the SSE response, persisting configurable state across serverless function invocations, and matching the interrupt event's `connection` object back to the pending LangGraph node — all while still streaming the rest of execution as SSE.

**3. Auth0 v4 Session Token Shape**
`@auth0/nextjs-auth0` v4 moved the refresh token from `session.accessToken` to `session.tokenSet.refreshToken`. Numerous type assertion gaps between the SDK's public types and actual runtime shape required careful inspection of the session payload and defensive type casting throughout the token resolution path.

**4. Sub-Agent Least Privilege vs. Orchestrator Routing**
The orchestrator needed to know *what* each agent can do (to write a good plan) without *having access* to those capabilities itself. We solved this by exporting agent capability descriptions as static strings into the orchestrator's system prompt, while keeping the actual tool bindings completely isolated to each sub-agent's config at runtime.

**5. GitHub Auto-Discovery Without Hallucination**
When users don't specify an `owner/repo`, the GitHub Agent would sometimes hallucinate repository names. We added a `list_user_repos` tool that the agent is instructed to call first, and encoded this as an explicit rule in the GitHub Agent's system prompt — eliminating hallucinated repo paths in testing.

**6. Windows CRLF Env Var Corruption**
Running `vercel dev` on Windows injects `\r\n` line endings into environment variables piped through the CLI. This silently corrupted Auth0 domain strings, causing every HTTPS request to fail with DNS resolution errors. We added a `cleanEnv()` sanitizer applied to every environment variable read across the entire codebase.

---

## Accomplishments We're Proud Of

- **End-to-end CIBA flow that actually works**: A user types "merge the open PR", the agent finds it, requests step-up authorization, the user's phone buzzes with the exact action description, they tap approve, and the merge completes — all within the same streaming response.

- **True least-privilege multi-agent architecture**: The GitHub Agent has never seen a Slack token. The Slack Agent has never seen a GitHub token. The orchestrator has seen neither. This isn't just policy — it's enforced by the token resolution layer.

- **Trust zones as a UX primitive**: We made authorization *visible*. Users can watch in real time as GREEN actions execute silently, YELLOW actions are logged, and RED actions pause and wait. The audit trail makes this retroactively inspectable too.

- **Zero-cost AI inference on a hackathon timeline**: By using Groq's free tier with Llama 3.3 70B, we ran hundreds of multi-agent test runs without spending a dollar on LLM compute.

- **Production-ready streaming architecture**: The SSE stream handles agent crashes, CIBA interrupts, and sub-agent errors gracefully — emitting structured error events to the UI rather than dropping the connection.

---

## What We Learned

- **Authorization is a product feature, not infrastructure.** Making trust zones visible to users — in real time, with audit history — fundamentally changes how people think about what an agent is doing on their behalf.

- **CIBA is the right primitive for agentic step-up.** Traditional OAuth redirects are disruptive mid-workflow. CIBA's out-of-band model (push notification + binding message) fits naturally into an agentic loop where the agent pauses and waits for human confirmation without breaking the UX.

- **Multi-agent least privilege requires deliberate API surface design.** It's not enough to say "agents are isolated." You have to architect the tool registry, the config threading, and the token resolution layer so that isolation is structurally enforced — not just a naming convention.

- **LangGraph is excellent for real-world agentic loops.** The `StateGraph` abstraction, `GraphInterrupt` for authorization hooks, and the configurable thread state made complex multi-agent orchestration manageable.

- **Streaming auth flows are genuinely hard.** Resuming a stateful, multi-step LLM chain across an async out-of-band authorization event (CIBA) while maintaining SSE continuity required careful architecture. The thread ID / configurable state pattern is the key.

---

## What's Next

- **Google Workspace Agent**: Calendar + Gmail tools with a third isolated sub-agent — already scaffolded in the tools directory.
- **Human-in-the-loop YELLOW zone**: Right now YELLOW actions execute without pause. A future "audit mode" would queue them for user review before execution.
- **Token Vault migration to native grant**: When available on the tenant, swap the Management API fallback for the native `federated-connection-access-token` grant with zero code changes in the agent layer.
- **Fine-grained RBAC**: Per-user, per-agent trust policies stored in the database alongside the audit trail — so a "read-only" user can connect agents that can only run GREEN zone tools.
- **Webhook-driven agents**: Instead of user-initiated prompts, trigger the orchestrator from GitHub webhooks (new PR opened → Slack notification + auto-label).

---

## Bonus Blog Post

### The Night I Realized Credentials Aren't Identity

Three days into building AgentNet, I hit a wall I hadn't anticipated. The agents were working. GitHub issues were being created, Slack messages were landing in the right channels. But every time I looked at the code, something felt wrong.

The GitHub Agent and the Slack Agent were both holding the same OAuth token — the user's session token — and just doing whatever they wanted with it. There was no record of which agent made which call. There was no way to stop a runaway agent short of revoking the entire session. And there was absolutely nothing preventing the GitHub Agent from accidentally (or maliciously, in a compromised scenario) using a Slack endpoint it had no business touching.

That's when the point of Auth0 Token Vault clicked for me — not as a feature, but as a philosophy.

Token Vault forced me to think about authorization at the *tool boundary*, not the application boundary. Each agent had to declare upfront what connection it needed and what scopes it required. The token was fetched at the moment of the call, scoped to that specific provider, and never passed around. When the GitHub Agent ran, it held a GitHub token. When the Slack Agent ran, it held a Slack token. Neither ever saw the other's credentials — not because I wrote an `if` statement to prevent it, but because the architecture made it structurally impossible.

The CIBA piece was the second revelation. I'd always thought of step-up auth as a login prompt — disruptive, jarring, a last resort. But an out-of-band push notification that says "AgentNet wants to merge PR #47 — approve?" is something completely different. It's the agent asking for permission in the same way a colleague would knock before doing something irreversible on your behalf. The binding message is dynamically built from the actual tool parameters, so the user is approving a specific action — not just signing off on a vague capability.

That's the shift AgentNet is really about: from agents that *have access* to agents that *earn authorization* — one action at a time.

---

## Built With

next.js typescript auth0 @auth0/ai-langchain @auth0/nextjs-auth0 langchain langgraph groq llama-3.3-70b tailwindcss framer-motion sqlite upstash-redis github-api slack-api vercel server-sent-events ciba token-vault oauth2 react

---

## Try It

**Live Demo**: [agentnet.vercel.app](https://agentnet.vercel.app)  
**GitHub Repository**: [github.com/your-username/agentnet](https://github.com/your-username/agentnet)  
**Demo Video**: [youtube.com/watch?v=...](https://youtube.com)

### To run locally:
```bash
git clone https://github.com/your-username/agentnet
cd agentnet
npm install --legacy-peer-deps
cp .env.example .env.local
# fill in AUTH0_*, GROQ_API_KEY
npm run dev
```
