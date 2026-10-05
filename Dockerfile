# FROM node:6-stretch
FROM node:18.13.0

# Upgrade the base image's ImageMagick packages to the patched Debian 11 security release
# (SNYK-DEBIAN11-IMAGEMAGICK-15339647 / CVE-2026-25971, fixed in 8:6.9.11.60+dfsg-1.3+deb11u11)
# and fail the build if any of them is still older than that.
ARG IMAGEMAGICK_MIN_VERSION=8:6.9.11.60+dfsg-1.3+deb11u11
RUN set -e; \
    pkgs=$(dpkg-query -W -f='${db:Status-Status} ${source:Package} ${Package}\n' | awk '$1=="installed" && $2=="imagemagick" {print $3}'); \
    apt-get update; \
    apt-get install -y --no-install-recommends --only-upgrade $pkgs; \
    rm -rf /var/lib/apt/lists/*; \
    for pkg in $pkgs; do \
      ver=$(dpkg-query -W -f='${Version}' "$pkg"); \
      dpkg --compare-versions "$ver" ge "$IMAGEMAGICK_MIN_VERSION" || { echo "$pkg $ver < $IMAGEMAGICK_MIN_VERSION"; exit 1; }; \
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
