FROM node:22-alpine3.24

RUN apk upgrade --no-cache

RUN mkdir -p /usr/src/goof /tmp/extracted_files \
    && chown -R node:node /usr/src/goof /tmp/extracted_files
WORKDIR /usr/src/goof

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --chown=node:node . .

USER node
EXPOSE 3001
EXPOSE 9229
ENTRYPOINT ["npm", "start"]
