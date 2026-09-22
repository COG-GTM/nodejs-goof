FROM node:26.6.0-alpine3.24

RUN mkdir -p /usr/src/goof
WORKDIR /usr/src/goof

COPY package.json ./
# The package manager is only needed at build time; dropping it keeps its
# dependency tree out of the runtime image.
RUN npm install --omit=dev \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx /root/.npm

COPY . /usr/src/goof

USER node
EXPOSE 3001
ENTRYPOINT ["node", "app.js"]
