# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-IMAGEMAGICK-15339566 (CVE-2026-26284): node:18.13.0 ships
# imagemagick 8:6.9.11.60+dfsg-1.3; pull the bullseye-security fix.
ARG IMAGEMAGICK_MIN_VERSION=8:6.9.11.60+dfsg-1.3+deb11u11
RUN apt-get update \
  && apt-get install -y --no-install-recommends --only-upgrade \
    $(dpkg-query -W -f='${binary:Package}\n' | grep -E '^(imagemagick|libmagick)') \
  && rm -rf /var/lib/apt/lists/* \
  && dpkg --compare-versions \
    "$(dpkg-query -W -f='${Version}' imagemagick-6-common)" ge "$IMAGEMAGICK_MIN_VERSION"

RUN mkdir /usr/src/goof
RUN mkdir /tmp/extracted_files
COPY . /usr/src/goof
WORKDIR /usr/src/goof

RUN npm update
RUN npm install
EXPOSE 3001
EXPOSE 9229
ENTRYPOINT ["npm", "start"]
