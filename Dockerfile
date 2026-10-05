# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-OPENSSL-15969296 (CVE-2026-28387): fixed in openssl 1.1.1w-0+deb11u7
RUN apt-get update \
  && apt-get install -y --only-upgrade --no-install-recommends openssl libssl1.1 \
  && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' openssl)" ge 1.1.1w-0+deb11u7 \
  && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libssl1.1)" ge 1.1.1w-0+deb11u7 \
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
