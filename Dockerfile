# FROM node:6-stretch
FROM node:18.13.0

# bug fix: patch imagemagick (SNYK-DEBIAN11-IMAGEMAGICK-15339526 / CVE-2026-25798)
# shipped in the base image; deb11u10 or later carries the fix.
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade \
        imagemagick \
        imagemagick-6-common \
        libmagickcore-dev \
        libmagickwand-dev \
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
