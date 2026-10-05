# FROM node:6-stretch
FROM node:18.20.8-bullseye

RUN apt-get update \
 && apt-get install -y --no-install-recommends --only-upgrade libpng16-16 libpng-dev \
 && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libpng16-16)" ge 1.6.37-3+deb11u2 \
 && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libpng-dev)" ge 1.6.37-3+deb11u2 \
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
