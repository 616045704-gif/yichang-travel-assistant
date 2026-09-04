# Repository Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize version control and establish project rules that require focused commits and successful relevant tests before delivery.

**Architecture:** The repository root contains a concise `AGENTS.md` that governs all future work. Git provides the audit trail; each future logical change is verified and committed separately. This bootstrap task uses a documentation-only validation because no application code or test runner exists yet.

**Tech Stack:** Git, Markdown, PowerShell, future WeChat Mini Program tooling.

## Global Constraints

- Initialize Git only in `D:\ChatGPT\宜昌旅游助手`.
- Never include Dify API keys, cloud credentials, device identifiers, or other secrets in Git.
- Every logical code change requires corresponding new or updated automated tests, or an explicit note in the commit body explaining why automated testing is not applicable.
- Run all relevant tests and validation commands successfully before each delivery and each commit.
- Create one focused Git commit for each independently reviewable change; do not combine unrelated work.
- Do not use destructive Git operations such as `reset --hard` or force-push.

---

### Task 1: Establish repository rules and first commit

**Files:**
- Create: `AGENTS.md`
- Create: `.gitignore`
- Create: `.git/` Git metadata directory
- Modify: `docs/superpowers/plans/2026-09-04-repository-bootstrap-plan.md`

**Interfaces:**
- Consumes: the approved product design document and the user-provided version-control requirements.
- Produces: project-wide rules applied by future Codex sessions, a clean Git repository, and a baseline commit.

- [x] **Step 1: Create `AGENTS.md` with the enforced workflow**

The existing Chinese `AGENTS.md` already contains the required workflow and is preserved.

```markdown
# Project Rules

## Git and delivery discipline

1. Treat every independently reviewable change as a separate logical change.
2. After completing each logical change, create one focused Git commit with a clear Conventional Commit-style message.
3. Before each commit and before each delivery, run every test and validation command relevant to the changed files. Do not commit or deliver when a relevant check fails.
4. Every code change must add or update automated tests that cover the changed behavior. If automated testing is genuinely not applicable (for example, a Markdown-only documentation change), record the reason in the commit body and run an appropriate validation instead.
5. Never commit secrets. Store Dify keys and cloud credentials only in cloud-function environment variables or local untracked configuration files.
6. Do not use destructive Git commands such as `git reset --hard` or force-push without explicit user approval.
```

- [x] **Step 2: Create `.gitignore` for secrets and generated output**

Also ignore `project.private.config.json` (local WeChat developer-tool configuration).

```gitignore
# Local secrets and environment configuration
.env
.env.*
!.env.example
secrets/

# Local dependency and build output
node_modules/
dist/
coverage/

# Editor and operating-system files
.DS_Store
Thumbs.db
```

- [x] **Step 3: Validate the rules and ignore configuration before initializing Git**

Run: `Select-String -Path AGENTS.md -Pattern '每次代码改动都必须新增或更新覆盖该行为的自动化测试'; Select-String -Path .gitignore -Pattern '^\.env$'; git --version`

Expected: the exact test rule and `.env` ignore rule are printed, followed by an installed Git version.

- [x] **Step 4: Initialize Git and inspect the first staged change set**

Run: `git init; git add AGENTS.md .gitignore docs/superpowers/specs/2026-09-04-yichang-travel-mini-program-design.md docs/superpowers/plans/2026-09-04-repository-bootstrap-plan.md; git diff --cached --check; git status --short`

Expected: Git initializes in the project directory, whitespace validation exits successfully, and only the four intended files are staged.

- [ ] **Step 5: Create the bootstrap commit with validation note**

Run: `git commit -m "chore: initialize project workflow" -m "Validation: checked repository rules, ignore patterns, and staged whitespace. Automated tests are not applicable because this baseline contains only project documentation and Git configuration."`

Expected: one root commit is created with the four intended files.

- [ ] **Step 6: Verify the committed baseline is clean**

Run: `git status --short; git log -1 --oneline; git show --check --stat --oneline HEAD`

Expected: no status output, then one `chore: initialize project workflow` commit and a clean file summary.

Execution note: Steps 5–6 are verified after this plan is committed, using Git history and status as the completion record. An unrelated untracked `docs/superpowers/specs/2026-09-04-yichang-travel-mini-program-technical-design.md` appeared during execution; preserve it outside this four-file baseline. Final verification must report it rather than claim an entirely clean working tree.
