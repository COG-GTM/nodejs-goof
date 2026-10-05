# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-LIBXSLT-9407505 (CVE-2024-55549): upgrade libxslt from the
# base image's 1.1.34-4+deb11u1 to the patched Debian 11 build.
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade libxslt1.1 libxslt1-dev \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libxslt1.1)" ge 1.1.34-4+deb11u2 \
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
