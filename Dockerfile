# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-IMAGEMAGICK-14725516 (CVE-2025-68618): upgrade every installed
# imagemagick binary package to the bullseye-security fix and fail the build
# if the fixed version is not reached.
ARG IMAGEMAGICK_MIN_VERSION=8:6.9.11.60+dfsg-1.3+deb11u8
RUN apt-get update \
  && apt-get install -y --no-install-recommends --only-upgrade \
    $(dpkg-query -W -f='${binary:Package} ${source:Package}\n' | awk '$2 == "imagemagick" { print $1 }') \
  && rm -rf /var/lib/apt/lists/* \
  && dpkg-query -W -f='${binary:Package} ${source:Package} ${Version}\n' \
    | awk '$2 == "imagemagick" { print $1, $3 }' \
    | while read -r pkg ver; do \
        dpkg --compare-versions "$ver" ge "$IMAGEMAGICK_MIN_VERSION" \
          || { echo "$pkg $ver < $IMAGEMAGICK_MIN_VERSION" >&2; exit 1; }; \
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
