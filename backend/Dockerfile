# =============================================================================
# DerLg Backend — Multi-stage Dockerfile
# =============================================================================
# Targets:
#   development — hot-reload via volume mount (used by docker-compose.yml)
#   production  — compiled output, minimal image (used by docker-compose.prod.yml)
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Dependencies
# ---------------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ---------------------------------------------------------------------------
# Stage 2: Build
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 3: Production
# ---------------------------------------------------------------------------
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Copy production dependencies and build output
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package*.json ./

EXPOSE 3001

USER node

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]

# ---------------------------------------------------------------------------
# Stage 4: Development (optional, for docker-compose.yml)
# ---------------------------------------------------------------------------
FROM node:22-alpine AS development
WORKDIR /app
ENV NODE_ENV=development
ENV PORT=3001

COPY package*.json ./
RUN npm ci

EXPOSE 3001

CMD ["npm", "run", "start:dev"]
