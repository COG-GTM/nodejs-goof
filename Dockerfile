# FROM node:6-stretch
FROM node:18.13.0

# Upgrade the base image's ImageMagick packages to the patched bullseye-security
# release (SNYK-DEBIAN11-IMAGEMAGICK-10752989 / CVE-2025-53014) and fail the build
# if the fixed version is not installed.
RUN apt-get update \
    && apt-get install -y --only-upgrade --no-install-recommends \
       $(dpkg-query -W -f='${db:Status-Abbrev} ${Package}\n' '*magick*' | awk '$1 == "ii" {print $2}') \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' imagemagick-6-common)" ge '8:6.9.11.60+dfsg-1.3+deb11u6' \
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
