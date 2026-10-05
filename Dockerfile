# FROM node:6-stretch
FROM node:18.13.0

# The todo image-link feature shells out to ImageMagick `identify`, so keep
# ImageMagick but upgrade every package built from the Debian 11 imagemagick
# source to the patched release (SNYK-DEBIAN11-IMAGEMAGICK-15339540,
# CVE-2026-25965, fixed in 8:6.9.11.60+dfsg-1.3+deb11u10). The build fails if
# the patched version is not installed.
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade \
        $(dpkg-query -W -f='${Package} ${Source}\n' | awk '$1 == "imagemagick" || $2 == "imagemagick" { print $1 }') \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' imagemagick-6-common)" ge '8:6.9.11.60+dfsg-1.3+deb11u10' \
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
