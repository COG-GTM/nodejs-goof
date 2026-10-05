# FROM node:6-stretch
FROM node:18.20.8-bullseye

# SNYK-DEBIAN11-IMAGEMAGICK-1244104 (CVE-2021-20309): fail the build if the base image regresses below the fixed ImageMagick.
RUN dpkg --compare-versions "$(dpkg-query -W -f='${Version}' imagemagick-6-common)" ge '8:6.9.11.60+dfsg-1.3+deb11u2'

RUN mkdir /usr/src/goof
RUN mkdir /tmp/extracted_files
COPY . /usr/src/goof
WORKDIR /usr/src/goof

RUN npm update
RUN npm install
EXPOSE 3001
EXPOSE 9229
ENTRYPOINT ["npm", "start"]
