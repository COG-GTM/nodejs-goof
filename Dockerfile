# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-IMAGEMAGICK-15044348 (CVE-2026-23876): upgrade the ImageMagick
# packages shipped in the base image to the patched Debian 11 security release.
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade \
       $(dpkg-query -W -f='${db:Status-Abbrev} ${binary:Package}\n' 'imagemagick*' 'libmagick*' | awk '$1 == "ii" {print $2}') \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' imagemagick-6-common)" ge '8:6.9.11.60+dfsg-1.3+deb11u9' \
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
