# FROM node:6-stretch
FROM node:18.13.0

# Upgrade every binary package built from the imagemagick source package
# (SNYK-DEBIAN11-IMAGEMAGICK-2928988 / CVE-2022-32547, fixed in
# 8:6.9.11.60+dfsg-1.3+deb11u2) and fail the build if the installed
# version is still below the fix.
RUN apt-get update \
    && apt-get install -y --only-upgrade --no-install-recommends \
        $(dpkg-query -W -f='${binary:Package} ${source:Package}\n' | awk '$2 == "imagemagick" { print $1 }') \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' imagemagick-6-common)" ge "8:6.9.11.60+dfsg-1.3+deb11u2" \
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
