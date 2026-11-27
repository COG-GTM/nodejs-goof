# FROM node:6-stretch
FROM node:22.23.4

RUN mkdir /usr/src/goof
WORKDIR /usr/src/goof
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . /usr/src/goof
RUN chown -R node:node /usr/src/goof
USER node
EXPOSE 3001
ENTRYPOINT ["npm", "start"]
