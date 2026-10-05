# FROM node:6-stretch
FROM node:18.20.8-bullseye

# SNYK-DEBIAN11-GNUTLS28-16344323: pull Debian 11 security updates
# (libgnutls30 >= 3.7.1-5+deb11u10) on top of the base image.
RUN apt-get update \
    && apt-get upgrade -y --no-install-recommends \
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
