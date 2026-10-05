# FROM node:6-stretch
FROM node:18.20.8-bullseye

# SNYK-DEBIAN11-LIBDE265-3361564 (CVE-2023-27103): fail the build if the base image ships a vulnerable libde265
RUN dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libde265-0)" ge 1.0.11-0+deb11u2

RUN mkdir /usr/src/goof
RUN mkdir /tmp/extracted_files
COPY . /usr/src/goof
WORKDIR /usr/src/goof

RUN npm update
RUN npm install
EXPOSE 3001
EXPOSE 9229
ENTRYPOINT ["npm", "start"]
