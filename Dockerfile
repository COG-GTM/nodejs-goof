# FROM node:6-stretch
FROM node:18.13.0

RUN mkdir /usr/src/goof
COPY . /usr/src/goof
WORKDIR /usr/src/goof

RUN npm update
RUN npm install
EXPOSE 3001
EXPOSE 9229
ENTRYPOINT ["npm", "start"]
