# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-GDKPIXBUF-10663979 (CVE-2025-7345): upgrade gdk-pixbuf to the fixed bullseye-security build.
RUN apt-get update \
 && apt-get install -y --no-install-recommends --only-upgrade \
      $(dpkg-query -W -f='${binary:Package} ${source:Package}\n' | awk '$2 == "gdk-pixbuf" { print $1 }') \
 && dpkg-query -W -f='${binary:Package} ${Version}\n' gir1.2-gdkpixbuf-2.0 libgdk-pixbuf-2.0-0 \
 && for pkg in gir1.2-gdkpixbuf-2.0 libgdk-pixbuf-2.0-0; do \
      dpkg --compare-versions "$(dpkg-query -W -f='${Version}' "$pkg")" ge 2.42.2+dfsg-1+deb11u4 || exit 1; \
    done \
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
