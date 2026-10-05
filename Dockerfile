# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-OPENSSL-15123191 (CVE-2025-69421): upgrade the base image's
# openssl packages (openssl, libssl1.1) to the bullseye-security fix and fail
# the build if the installed version is still older than 1.1.1w-0+deb11u5.
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade \
       $(dpkg-query -W -f='${binary:Package} ${source:Package}\n' | awk '$2 == "openssl" { print $1 }') \
    && dpkg-query -W -f='${binary:Package} ${Version} ${source:Package}\n' \
       | awk '$3 == "openssl" { print $1, $2 }' \
       | while read -r pkg ver; do \
           dpkg --compare-versions "$ver" ge 1.1.1w-0+deb11u5 \
             || { echo "$pkg $ver is older than 1.1.1w-0+deb11u5" >&2; exit 1; }; \
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
