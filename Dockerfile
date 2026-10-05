# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-CURL-5955037 (CVE-2023-38545): curl/libcurl from the base image
# are vulnerable; pull the fixed bullseye-security build and fail if it's older.
RUN apt-get update \
 && apt-get install -y --no-install-recommends --only-upgrade \
      curl libcurl4 libcurl3-gnutls libcurl4-openssl-dev \
 && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' curl)" ge 7.74.0-1.3+deb11u10 \
 && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libcurl4)" ge 7.74.0-1.3+deb11u10 \
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
