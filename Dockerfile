# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-LIBXML2-10345641 (CVE-2025-6021): upgrade libxml2 to the
# patched Debian 11 build and fail the build if it is not available.
RUN apt-get update \
  && apt-get install -y --only-upgrade --no-install-recommends libxml2 libxml2-dev \
  && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libxml2)" ge 2.9.10+dfsg-6.7+deb11u8 \
  && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libxml2-dev)" ge 2.9.10+dfsg-6.7+deb11u8 \
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
