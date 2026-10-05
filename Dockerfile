# FROM node:6-stretch
FROM node:18.20.5-alpine3.19

# routes/index.js shells out to ImageMagick's `identify`, which the
# Debian-based node image bundled but the alpine image does not.
RUN apk add --no-cache imagemagick

RUN mkdir -p /usr/src/goof
RUN mkdir /tmp/extracted_files
COPY . /usr/src/goof
WORKDIR /usr/src/goof

RUN npm update
RUN npm install
EXPOSE 3001
EXPOSE 9229
ENTRYPOINT ["npm", "start"]
