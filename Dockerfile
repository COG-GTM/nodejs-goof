# FROM node:6-stretch
FROM node:18.20.8-bullseye

# SNYK-DEBIAN11-LIBXML2-5747746 (CVE-2022-2309): pull in the patched Debian 11
# OS packages and fail the build if libxml2 is older than the fixed release.
RUN apt-get update \
  && apt-get upgrade -y --no-install-recommends \
  && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libxml2)" ge 2.9.10+dfsg-6.7+deb11u5 \
  && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libxml2-dev)" ge 2.9.10+dfsg-6.7+deb11u5 \
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
