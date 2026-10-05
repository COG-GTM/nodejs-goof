# FROM node:6-stretch
FROM node:18.20.8-bullseye

# SNYK-DEBIAN11-LIBXSLT-9407509 (CVE-2025-24855): pull every Debian 11 security
# fix into the image and fail the build if libxslt is still below deb11u2.
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y --no-install-recommends \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libxslt1.1)" ge '1.1.34-4+deb11u2' \
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
