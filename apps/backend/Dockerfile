# syntax=docker/dockerfile:1

FROM node:20-bullseye-slim AS deps

WORKDIR /app

COPY package.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

FROM deps AS dev

WORKDIR /app

COPY tsconfig.json ./
COPY jest.config.cjs ./
COPY src ./src
COPY test ./test

FROM deps AS build

WORKDIR /app

COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:20-bullseye-slim AS runtime

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends libssl1.1 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist

EXPOSE 3000

USER node
CMD ["node", "dist/index.js"]
