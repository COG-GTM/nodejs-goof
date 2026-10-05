# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-OPENSSH-15922681 (CVE-2026-35385): base image ships openssh-client 1:8.4p1-5+deb11u1
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade openssh-client \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' openssh-client)" ge '1:8.4p1-5+deb11u7' \
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
