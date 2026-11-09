FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_STAFF_AUTH_URL
ENV VITE_STAFF_AUTH_URL=$VITE_STAFF_AUTH_URL
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates && \
    npm ci --omit=dev && \
    rm -rf /var/lib/apt/lists/*
COPY --from=build /app/dist ./dist
COPY server ./server
COPY scripts/start-production.mjs ./scripts/start-production.mjs

# Render's free instance cannot reliably keep the embedded model server alive.
# Production uses the deterministic local analyzer unless an external provider
# is explicitly configured.
ENV AI_PROVIDER=local
RUN mkdir -p .data
# Render and most hosts inject PORT; the server falls back to 3001 locally.
ENV PORT=3001
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=4s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.js"]
