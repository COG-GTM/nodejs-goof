# FROM node:6-stretch
FROM node:18.20.8-alpine3.21

RUN apk upgrade --no-cache

RUN mkdir -p /usr/src/goof
RUN mkdir -p /tmp/extracted_files
COPY . /usr/src/goof
WORKDIR /usr/src/goof

RUN npm update
RUN npm install
EXPOSE 3001
EXPOSE 9229
ENTRYPOINT ["npm", "start"]
