# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-IMAGEMAGICK-12202818 (CVE-2025-55212): node:18.13.0 ships
# imagemagick 8:6.9.11.60+dfsg-1.3. Upgrade every binary built from the
# imagemagick source package from bullseye-security and fail the build if the
# fixed version is not installed.
ARG IMAGEMAGICK_MIN_VERSION=8:6.9.11.60+dfsg-1.3+deb11u6
RUN set -eu; \
    pkgs="$(dpkg-query -W -f='${db:Status-Abbrev} ${binary:Package} ${source:Package}\n' | awk '$1 == "ii" && $3 == "imagemagick" { print $2 }')"; \
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
