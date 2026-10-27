# syntax=docker/dockerfile:1

# Build stage: full image has the toolchain for the kerberos native addon
FROM node:22-bookworm AS build
WORKDIR /usr/src/goof
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# Runtime stage
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3001
WORKDIR /usr/src/goof
RUN mkdir -p /tmp/extracted_files && chown node:node /tmp/extracted_files
COPY --from=build --chown=node:node /usr/src/goof/node_modules ./node_modules
COPY --chown=node:node package.json app.js mongoose-db.js typeorm-db.js utils.js ./
COPY --chown=node:node entity ./entity
COPY --chown=node:node routes ./routes
COPY --chown=node:node service ./service
COPY --chown=node:node views ./views
COPY --chown=node:node public ./public
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "require('http').get('http://127.0.0.1:'+(process.env.PORT||3001)+'/healthz',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]
CMD ["node", "app.js"]
