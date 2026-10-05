# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-GNUTLS28-16344311 (CVE-2026-5260): the base image ships
# gnutls28 3.7.1-5+deb11u2. Kept on Debian 11 because routes/index.js shells
# out to ImageMagick's `identify`, which the Alpine images don't include.
ARG GNUTLS_MIN_VERSION=3.7.1-5+deb11u10
RUN set -eu; \
    pkgs="$(dpkg-query -W -f='${Package} ${source:Package}\n' | awk '$2=="gnutls28" {print $1}')"; \
    apt-get update; \
    apt-get install -y --no-install-recommends --only-upgrade $pkgs; \
    for p in $pkgs; do \
      v="$(dpkg-query -W -f='${Version}' "$p")"; \
      dpkg --compare-versions "$v" ge "$GNUTLS_MIN_VERSION" \
        || { echo "$p $v < $GNUTLS_MIN_VERSION" >&2; exit 1; }; \
    done; \
    rm -rf /var/lib/apt/lists/*

RUN mkdir /usr/src/goof
RUN mkdir /tmp/extracted_files
COPY . /usr/src/goof
WORKDIR /usr/src/goof

RUN npm update
RUN npm install
EXPOSE 3001
EXPOSE 9229
ENTRYPOINT ["npm", "start"]
