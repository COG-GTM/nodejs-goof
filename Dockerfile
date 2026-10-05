# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-LIBXSLT-10691006 (CVE-2025-7424): the base image ships
# libxslt 1.1.34-4+deb11u1; upgrade to the patched Debian 11 build and fail
# the build if it is still below 1.1.34-4+deb11u3.
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade libxslt1.1 libxslt1-dev \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libxslt1.1)" ge 1.1.34-4+deb11u3 \
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
