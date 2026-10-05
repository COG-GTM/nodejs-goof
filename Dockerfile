# FROM node:6-stretch
FROM node:18.20.8-bullseye

# SNYK-DEBIAN11-LIBDE265-2445047 (CVE-2022-1253): libde265-0 1.0.8-1 ships in the
# base image (pulled in by ImageMagick, which routes/index.js calls via `identify`).
# Apply the Debian 11 security updates to every package baked into the image and
# fail the build if libde265-0 is still older than the fixed release.
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y --no-install-recommends \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libde265-0)" ge '1.0.11-0+deb11u1' \
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
