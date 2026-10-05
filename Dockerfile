# FROM node:6-stretch
FROM node:18.13.0

# node:18.13.0 (debian:11) ships imagemagick 8:6.9.11.60+dfsg-1.3; upgrade every
# binary built from the imagemagick source to the bullseye-security release
# (SNYK-DEBIAN11-IMAGEMAGICK-11808490 / CVE-2025-55154, fixed in +deb11u6).
RUN apt-get update \
  && apt-get install -y --no-install-recommends --only-upgrade \
    $(dpkg-query -W -f='${binary:Package} ${source:Package}\n' | awk '$2 == "imagemagick" { print $1 }') \
  && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' imagemagick-6-common)" \
    ge 8:6.9.11.60+dfsg-1.3+deb11u6 \
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
