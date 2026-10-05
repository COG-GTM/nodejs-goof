# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-GNUTLS28-16344323 (CVE-2026-33845): upgrade libgnutls30 to the
# patched Debian 11 build and fail the image build if it is still vulnerable.
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade libgnutls30 \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libgnutls30)" ge 3.7.1-5+deb11u10 \
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
