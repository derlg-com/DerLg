---
name: api cwd is apps/api but shell resets to apps/web
description: The agent's shell cwd resets to apps/web between bash calls even though the env block reports apps/api; always cd to apps/api for api npm scripts.
type: project
---

The agent env block reports working directory `/home/rayu/DerLg/apps/api`, but the actual shell cwd for Bash tool calls is `/home/rayu/DerLg/apps/web`.

**Why:** Two `package.json` files share the monorepo root context; without an explicit `cd` the shell lands in web, so `npm install`/`npm run build`/`npm test` hit the web package instead of the api package. This caused an accidental install of AWS SDK deps into web during Task 19.

**How to apply:** For any api-side npm script (`build`, `test`, `install`, `prisma`), prefix the command with `cd /home/rayu/DerLg/apps/api && ...`. Verify with `grep '"name"' package.json` before running install/build when in doubt.