# FROM node:6-stretch
FROM node:18.13.0

# The base image ships aom/libaom0 1.0.0.errata1-3, vulnerable to CVE-2024-5171
# (SNYK-DEBIAN11-AOM-7197980). Pull the patched 1.0.0.errata1-3+deb11u2 from
# Debian security. libaom0 is pulled in by the image's imagemagick -> libheif1.
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade libaom0 \
    && dpkg-query -W libaom0 \
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
