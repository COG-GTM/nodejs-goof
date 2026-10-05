# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-TIFF-15793728 (CVE-2026-4775): libtiff5 is fixed in 4.2.0-1+deb11u8
RUN apt-get update \
  && apt-get install -y --no-install-recommends --only-upgrade libtiff5 \
  && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libtiff5)" ge 4.2.0-1+deb11u8 \
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
