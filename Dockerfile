# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-LCMS2-16104014 (CVE-2026-41254): upgrade liblcms2-2 to the fixed Debian 11 build
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade liblcms2-2=2.12~rc1-2+deb11u1 \
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
