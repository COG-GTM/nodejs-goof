# FROM node:6-stretch
FROM node:18.13.0

# ImageMagick backs the `identify` call in routes/index.js. The base image ships
# 8:6.9.11.60+dfsg-1.3; upgrade every binary built from the imagemagick source
# package to the Debian 11 security release (SNYK-DEBIAN11-IMAGEMAGICK-16078236,
# CVE-2026-33900, fixed in +deb11u12), and fail the build if it is not available.
ARG IMAGEMAGICK_MIN_VERSION=8:6.9.11.60+dfsg-1.3+deb11u12
RUN set -eu; \
    pkgs="$(dpkg-query -W -f='${binary:Package} ${source:Package}\n' | awk '$2 == "imagemagick" { print $1 }')"; \
    [ -n "$pkgs" ]; \
    apt-get update; \
    apt-get install -y --no-install-recommends --only-upgrade $pkgs; \
    rm -rf /var/lib/apt/lists/*; \
    dpkg-query -W -f='${binary:Package} ${Version}\n' $pkgs | while read -r pkg ver; do \
      dpkg --compare-versions "$ver" ge "$IMAGEMAGICK_MIN_VERSION" \
        || { echo "$pkg $ver is older than $IMAGEMAGICK_MIN_VERSION" >&2; exit 1; }; \
    done

RUN mkdir /usr/src/goof
RUN mkdir /tmp/extracted_files
COPY . /usr/src/goof
WORKDIR /usr/src/goof

RUN npm update
RUN npm install
EXPOSE 3001
EXPOSE 9229
ENTRYPOINT ["npm", "start"]
