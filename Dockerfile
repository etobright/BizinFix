FROM node:22-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium fonts-liberation fonts-dejavu-core ca-certificates gosu \
    && rm -rf /var/lib/apt/lists/* \
    && install -d -o node -g node /app

WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
USER node
RUN npm ci --include=dev

COPY --chown=node:node . .
RUN npm run build

ENV PORT=10000 NODE_ENV=production \
    STUDIO_HOST=0.0.0.0 \
    STUDIO_DATA_DIR=/app/studio-data \
    STUDIO_CHROMIUM=/usr/bin/chromium
USER root
EXPOSE 10000
CMD ["sh", "-c", "install -d -o node -g node -m 0750 \"$STUDIO_DATA_DIR\" && exec gosu node node server/index.mjs"]
