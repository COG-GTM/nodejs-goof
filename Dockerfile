# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-LIBDE265-15760068 (CVE-2026-33164): libde265-0 is pulled in via
# imagemagick > libheif1; upgrade it from bullseye-security and fail the build
# if the fixed version is not installed.
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade libde265-0 \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libde265-0)" ge 1.0.11-0+deb11u4 \
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
