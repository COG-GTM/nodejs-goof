# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-OPENJPEG2-1301277 (CVE-2021-3575): libopenjp2-7 2.4.0-3 ships via imagemagick in the base image
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade libopenjp2-7 \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libopenjp2-7)" ge 2.4.0-3+deb11u1 \
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
