# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-IMAGEMAGICK-12549182 (CVE-2025-57807): the base image ships
# imagemagick 8:6.9.11.60+dfsg-1.3; upgrade to the fixed bullseye-security build.
RUN apt-get update \
 && apt-get install -y --no-install-recommends --only-upgrade \
      $(dpkg-query -W -f='${binary:Package}\n' | grep magick) \
 && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' imagemagick-6-common)" \
      ge 8:6.9.11.60+dfsg-1.3+deb11u6 \
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
