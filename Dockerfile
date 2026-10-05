# FROM node:6-stretch
FROM node:18.20.8-bullseye

# Pull Debian 11 security updates for OS packages shipped in the base image
# (e.g. glib2.0 2.66.8-1+deb11u7 for SNYK-DEBIAN11-GLIB20-14267938).
RUN apt-get update \
  && apt-get -y upgrade \
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
