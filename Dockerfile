# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-GIT-537128 (CVE-2019-1387): the base image ships git/git-man
# 1:2.30.2-1; pull the patched Debian 11 security build.
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends --only-upgrade git git-man \
    && for pkg in git git-man; do \
         dpkg --compare-versions "$(dpkg-query -W -f='${Version}' "$pkg")" ge '1:2.30.2-1+deb11u3' \
           || { echo "$pkg is older than 1:2.30.2-1+deb11u3" >&2; exit 1; }; \
       done \
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
