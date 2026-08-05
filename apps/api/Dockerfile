# DerLg API — NestJS + Prisma.
#
# Debian (bookworm) base rather than alpine: Prisma's query engine and argon2's
# native addon both want glibc + a standard OpenSSL. The image is a little
# larger than an alpine equivalent, but it builds and runs without native-build
# gymnastics.
FROM node:20-bookworm-slim AS build

# Build tools for native addons (argon2). Prisma generate also needs OpenSSL
# headers, which ship in this base.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first so a source change does not bust the dep layer.
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

# Generate the Prisma client into node_modules, then compile.
RUN npx prisma generate
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

# ---------------------------------------------------------------------------- #
FROM node:20-bookworm-slim AS runtime

# OpenSSL is required by Prisma's query engine at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# Carry the compiled output, the Prisma schema + migrations, and the full
# node_modules from the build stage (prisma CLI is needed for `migrate deploy`
# at container start).
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./

EXPOSE 3101

# Apply pending migrations, then start the server. A fresh `docker compose up`
# therefore brings the schema up to date before the API accepts traffic.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]