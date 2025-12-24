# syntax=docker/dockerfile:1

ARG REACT_APP_GRAPHQL_URL=http://localhost:4000/graphql
ARG REACT_APP_TENANT_ID=11111111-1111-1111-1111-111111111111
ARG REACT_APP_USER_ID=22222222-2222-2222-2222-222222222222

FROM node:20-bullseye-slim AS deps
WORKDIR /app

COPY package.json ./
RUN npm install

ENV REACT_APP_GRAPHQL_URL=$REACT_APP_GRAPHQL_URL
ENV REACT_APP_TENANT_ID=$REACT_APP_TENANT_ID
ENV REACT_APP_USER_ID=$REACT_APP_USER_ID


FROM deps AS development
WORKDIR /app

ENV HOST=0.0.0.0
ENV PORT=3000

COPY . .

EXPOSE 3000
CMD ["npm", "run", "start-js"]


FROM deps AS build
WORKDIR /app

COPY . .
RUN npm run build


FROM nginx:1.27-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
