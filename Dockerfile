FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_STAFF_AUTH_URL
ENV VITE_STAFF_AUTH_URL=$VITE_STAFF_AUTH_URL
RUN npm run build

FROM node:24-bookworm-slim AS llama-build
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential cmake git && \
    git clone --depth 1 https://github.com/ggml-org/llama.cpp.git /src/llama.cpp && \
    cmake -S /src/llama.cpp -B /src/llama-build \
      -DGGML_NATIVE=OFF \
      -DGGML_OPENMP=ON \
      -DLLAMA_BUILD_SERVER=ON \
      -DLLAMA_CURL=OFF && \
    cmake --build /src/llama-build --config Release --target llama-server -j2 && \
    apt-get purge -y build-essential cmake git && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

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
COPY --from=llama-build /src/llama-build/bin/llama-server /opt/llama/llama-server

# Keep a compact open-source model inside the Render image. The model server is
# bound to loopback, so private support text stays inside this container.
ENV AI_PROVIDER=llamacpp \
    LLAMACPP_URL=http://127.0.0.1:8080 \
    LLAMACPP_MODEL=/app/models/smollm2-135m-instruct-q3_k_m.gguf
RUN mkdir -p .data
# Render and most hosts inject PORT; the server falls back to 3001 locally.
ENV PORT=3001
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=4s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "scripts/start-production.mjs"]
