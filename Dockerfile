# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-PAM-10378967 (CVE-2025-6020): base image ships pam 1.4.0-9+deb11u1
RUN apt-get update \
 && apt-get install -y --only-upgrade libpam0g libpam-modules libpam-modules-bin libpam-runtime \
 && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' libpam0g)" ge 1.4.0-9+deb11u2 \
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
