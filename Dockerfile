# FROM node:6-stretch
FROM node:18.20.5-bullseye

# Pull Debian 11 security updates for OS packages shipped in the base image
# (e.g. libheif1 >= 1.11.0-1+deb11u2, SNYK-DEBIAN11-LIBHEIF-3331227) and fail
# the build if the patched libheif is not installed.
RUN apt-get update \
  && apt-get upgrade -y --no-install-recommends \
  && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libheif1)" ge 1.11.0-1+deb11u2 \
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
