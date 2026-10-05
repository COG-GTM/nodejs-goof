# FROM node:6-stretch
FROM node:18.13.0

# The node:18.13.0 base (Debian 11) ships stale OS packages, e.g. ImageMagick
# 8:6.9.11.60+dfsg-1.3 (SNYK-DEBIAN11-IMAGEMAGICK-15044348, CVE-2026-23876).
# routes/index.js shells out to `identify`, so keep Debian + ImageMagick, pull
# every pending Debian 11 security update, and fail the build if the fixed
# ImageMagick release was not installed.
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y --no-install-recommends \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends --only-upgrade \
      $(dpkg-query -W -f='${db:Status-Abbrev} ${binary:Package}\n' \
          | awk '$1 == "ii" && $2 ~ /^(imagemagick|libmagick)/ { print $2 }') \
 && dpkg --compare-versions \
      "$(dpkg-query -W -f='${Version}' imagemagick-6-common)" \
      ge '8:6.9.11.60+dfsg-1.3+deb11u9' \
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
