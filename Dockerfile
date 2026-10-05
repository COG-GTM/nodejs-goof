# FROM node:6-stretch
FROM node:18.20.8-bullseye

RUN apt-get update \
  && apt-get upgrade -y --no-install-recommends \
  && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libexif12)" ge 0.6.22-3+deb11u1 \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir /usr/src/goof
RUN mkdir /tmp/extracted_files
COPY . /usr/src/goof
WORKDIR /usr/src/goof

RUN npm update
RUN npm install
EXPOSE 3001
EXPOSE 9229
ENTRYPOINT ["npm", "start"]
