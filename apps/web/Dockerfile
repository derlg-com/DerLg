# DerLg web — Next.js standalone.
#
# Requires `output: 'standalone'` in next.config.ts (already set), which emits a
# self-contained server plus a minimal node_modules into .next/standalone.
FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# ---------------------------------------------------------------------------- #
FROM node:20-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3100
ENV HOSTNAME=0.0.0.0

# Standalone server + the static assets it serves. No node_modules mount: the
# standalone output bundles the subset it actually needs.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3100
CMD ["node", "server.js"]