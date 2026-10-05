# FROM node:6-stretch
FROM node:18.13.0

# SNYK-DEBIAN11-IMAGEMAGICK-15339622 (CVE-2026-25987): the base image ships
# ImageMagick 8:6.9.11.60+dfsg-1.3. routes/index.js shells out to `identify`,
# so upgrade the installed ImageMagick packages in place and fail the build
# if the fixed Debian 11 security release is not what got installed.
RUN apt-get update \
 && apt-get install -y --no-install-recommends --only-upgrade \
      $(dpkg-query -W -f='${db:Status-Abbrev} ${binary:Package}\n' \
          | awk '$1 == "ii" && $2 ~ /^(imagemagick|libmagick)/ { print $2 }') \
 && dpkg --compare-versions \
      "$(dpkg-query -W -f='${Version}' imagemagick-6-common)" \
      ge '8:6.9.11.60+dfsg-1.3+deb11u10' \
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
