# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --no-audit --no-fund

COPY . .
RUN npm run build

FROM denoland/deno:alpine-2.5.2 AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8000

COPY --from=builder /app/build ./build

RUN mkdir -p .data

EXPOSE 8000

CMD ["deno", "run", "-A", "--unstable-kv", "build/index.js"]
