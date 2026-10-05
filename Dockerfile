# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-IMAGEMAGICK-14725511 (CVE-2025-69204): upgrade every installed
# imagemagick binary package to the bullseye-security fix and fail the build if
# the fixed version is not reached. The base image is kept because the app shells
# out to ImageMagick's `identify` (routes/index.js).
ARG IMAGEMAGICK_MIN_VERSION=8:6.9.11.60+dfsg-1.3+deb11u8
RUN set -e; \
    pkgs=$(dpkg-query -W -f='${db:Status-Status} ${source:Package} ${Package}\n' | awk '$1 == "installed" && $2 == "imagemagick" { print $3 }'); \
    apt-get update; \
    apt-get install -y --no-install-recommends --only-upgrade $pkgs; \
    rm -rf /var/lib/apt/lists/*; \
    for pkg in $pkgs; do \
      ver=$(dpkg-query -W -f='${Version}' "$pkg"); \
      dpkg --compare-versions "$ver" ge "$IMAGEMAGICK_MIN_VERSION" || { echo "$pkg $ver < $IMAGEMAGICK_MIN_VERSION" >&2; exit 1; }; \
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
