# FROM node:6-stretch
FROM node:18.20.8-bullseye

# SNYK-DEBIAN11-GDKPIXBUF-6207389 (CVE-2022-48622): gdk-pixbuf >= 2.42.2+dfsg-1+deb11u2
RUN apt-get update \
  && apt-get install -y --only-upgrade --no-install-recommends \
    libgdk-pixbuf-2.0-0 libgdk-pixbuf-2.0-dev libgdk-pixbuf2.0-bin \
    libgdk-pixbuf2.0-common gir1.2-gdkpixbuf-2.0 \
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
