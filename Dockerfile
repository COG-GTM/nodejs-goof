# FROM node:6-stretch
FROM node:18.20.8-bullseye

# SNYK-DEBIAN11-POSTGRESQL13-5838224 (CVE-2023-39417): libpq must be >= 13.13-0+deb11u1
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade libpq5 libpq-dev \
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
