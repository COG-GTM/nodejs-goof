# FROM node:6-stretch
FROM node:18.13.0

# Debian 11 security updates released after the base image was built.
# SNYK-DEBIAN11-IMAGEMAGICK-15726873 (CVE-2026-32636) needs imagemagick >= 8:6.9.11.60+dfsg-1.3+deb11u11.
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y --no-install-recommends \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' imagemagick-6-common)" ge '8:6.9.11.60+dfsg-1.3+deb11u11' \
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
