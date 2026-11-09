FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_STAFF_AUTH_URL
ENV VITE_STAFF_AUTH_URL=$VITE_STAFF_AUTH_URL
RUN npm run build

FROM ghcr.io/ggml-org/llama.cpp:server AS llama

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl libgomp1 && \
    npm ci --omit=dev && \
    mkdir -p /app/models && \
    curl --fail --location --retry 3 \
      'https://huggingface.co/tensorblock/SmolLM2-135M-Instruct-GGUF/resolve/main/SmolLM2-135M-Instruct-Q3_K_M.gguf?download=true' \
      --output /app/models/smollm2-135m-instruct-q3_k_m.gguf && \
    apt-get purge -y curl && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*
COPY --from=build /app/dist ./dist
COPY server ./server
COPY scripts/start-production.mjs ./scripts/start-production.mjs
COPY --from=llama /app /opt/llama
COPY --from=llama /lib/x86_64-linux-gnu /opt/llama/lib
COPY --from=llama /usr/lib/x86_64-linux-gnu /opt/llama/usr-lib

# Keep a compact open-source model inside the Render image. The model server is
# bound to loopback, so private support text stays inside this container.
ENV AI_PROVIDER=llamacpp \
    LLAMACPP_URL=http://127.0.0.1:8080 \
    LLAMACPP_MODEL=/app/models/smollm2-135m-instruct-q3_k_m.gguf \
    LD_LIBRARY_PATH=/opt/llama/lib:/opt/llama/usr-lib
RUN mkdir -p .data
# Render and most hosts inject PORT; the server falls back to 3001 locally.
ENV PORT=3001
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=4s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/start-production.mjs"]
