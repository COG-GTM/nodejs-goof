# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-IMAGEMAGICK-15339502 (CVE-2026-25983): upgrade every installed
# imagemagick binary package and fail the build if the fix is not applied.
ARG IMAGEMAGICK_MIN_VERSION=8:6.9.11.60+dfsg-1.3+deb11u10
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade \
        $(dpkg-query -W -f='${binary:Package} ${source:Package}\n' | awk '$2 == "imagemagick" { print $1 }') \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' imagemagick-6-common)" ge "$IMAGEMAGICK_MIN_VERSION" \
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
