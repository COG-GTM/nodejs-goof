# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-IMAGEMAGICK-15339570 (CVE-2026-25796): the base image ships
# imagemagick 8:6.9.11.60+dfsg-1.3; upgrade the installed imagemagick packages
# from bullseye-security and fail the build if they are still below the fix.
RUN apt-get update \
  && apt-get install -y --no-install-recommends --only-upgrade \
    imagemagick imagemagick-6-common imagemagick-6.q16 \
    libmagickcore-6-arch-config libmagickcore-6-headers libmagickcore-6.q16-6 \
    libmagickcore-6.q16-6-extra libmagickcore-6.q16-dev libmagickcore-dev \
    libmagickwand-6-headers libmagickwand-6.q16-6 libmagickwand-6.q16-dev libmagickwand-dev \
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
