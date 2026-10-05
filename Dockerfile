# FROM node:6-stretch
FROM node:18.13.0

# python3.9 comes from the base image (mercurial > python3). Upgrade every binary
# built from the python3.9 source package past the vulnerable 3.9.2-1
# (SNYK-DEBIAN11-PYTHON39-14157076, CVE-2025-13836), and fail the build if the
# mirror cannot supply the fixed version.
ARG PYTHON39_MIN_VERSION=3.9.2-1+deb11u4
RUN set -eu; \
    pkgs="$(dpkg-query -W -f='${binary:Package} ${source:Package}\n' | awk '$2 == "python3.9" { print $1 }')"; \
    [ -n "$pkgs" ]; \
    apt-get update; \
    apt-get install -y --no-install-recommends --only-upgrade $pkgs; \
    rm -rf /var/lib/apt/lists/*; \
    dpkg-query -W -f='${binary:Package} ${Version}\n' $pkgs | while read -r pkg ver; do \
      dpkg --compare-versions "$ver" ge "$PYTHON39_MIN_VERSION" \
        || { echo "$pkg $ver is older than $PYTHON39_MIN_VERSION" >&2; exit 1; }; \
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
