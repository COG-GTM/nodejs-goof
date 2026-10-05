# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-IMAGEMAGICK-15339566 (CVE-2026-26284): upgrade every ImageMagick
# package shipped in the base image to the Debian 11 security release and fail
# the build if the fixed version is not installed.
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade \
        $(dpkg-query -W -f='${binary:Package}\n' | grep -E '^(imagemagick|libmagick)') \
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
