# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-GNUPG2-14723303 (CVE-2025-68973): gnupg2 fixed in 2.2.27-2+deb11u3
RUN apt-get update \
    && apt-get install -y --no-install-recommends --only-upgrade \
       dirmngr gnupg gnupg-l10n gnupg-utils gpg gpg-agent gpg-wks-client \
       gpg-wks-server gpgconf gpgsm gpgv \
    && dpkg --compare-versions "$(dpkg-query -W -f='${Version}' gpgv)" ge 2.2.27-2+deb11u3 \
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
