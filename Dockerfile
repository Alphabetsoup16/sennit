# syntax=docker/dockerfile:1

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/README.md ./README.md
COPY --from=build /app/sennit.config.example.yaml ./sennit.config.example.yaml

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:8787/healthz || exit 1

ENTRYPOINT ["node", "dist/cli/index.js", "serve", "--http-port", "8787", "--http-host", "0.0.0.0"]
