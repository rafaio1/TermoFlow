FROM node:20-bullseye-slim AS build

WORKDIR /app

COPY package*.json .
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM build AS test

COPY vitest.config.ts ./
COPY tests ./tests

CMD ["npm", "test"]

FROM build AS prod-deps

RUN npm prune --omit=dev

FROM node:20-bullseye-slim AS runner

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libssl1.1 ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
ENV PORT=4000

COPY --chown=node:node package*.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist

USER node

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
