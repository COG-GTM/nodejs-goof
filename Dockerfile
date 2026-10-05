# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-LIBXML2-8738026 (CVE-2025-27113): the base image ships
# libxml2 2.9.10+dfsg-6.7+deb11u3; upgrade to the fixed Debian 11 build.
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade libxml2 libxml2-dev \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libxml2)" ge 2.9.10+dfsg-6.7+deb11u6 \
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
