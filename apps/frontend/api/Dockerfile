# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json ./
RUN npm install


FROM deps AS development
WORKDIR /app

ENV NODE_ENV=development
ENV PORT=4000

COPY . .

EXPOSE 4000
CMD ["npm", "run", "dev"]


FROM deps AS production
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY . .

EXPOSE 4000
CMD ["npm", "start"]

