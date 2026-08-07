FROM node:22.22.2-bookworm-slim

RUN mkdir -p /usr/src/goof /tmp/extracted_files
WORKDIR /usr/src/goof

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN chown -R node:node /usr/src/goof /tmp/extracted_files
USER node

EXPOSE 3001
EXPOSE 9229
ENTRYPOINT ["npm", "start"]
