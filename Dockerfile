# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-IMAGEMAGICK-15339636 (CVE-2026-26283): upgrade the base image's
# ImageMagick packages to the fixed bullseye-security build. ImageMagick stays
# installed because the todo image demo in routes/index.js runs `identify`.
RUN apt-get update \
    && apt-get install -y --only-upgrade --no-install-recommends \
       $(dpkg-query -W -f='${db:Status-Abbrev} ${binary:Package} ${source:Package}\n' \
         | awk '$1 == "ii" && $3 == "imagemagick" { print $2 }') \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' imagemagick-6-common)" \
       ge '8:6.9.11.60+dfsg-1.3+deb11u10' \
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
