FROM python:3.11-slim
RUN mkdir /usr/src/goof && mkdir /tmp/extracted_files
COPY . /usr/src/goof
WORKDIR /usr/src/goof
# pyyaml==5.4.0 is intentionally pinned (vulnerable dep for Snyk scanning) but
# its sdist does not build against Cython 3.x, so install it under Cython<3
# first, then resolve the rest of the (wheel-available) requirements.
RUN pip install --no-cache-dir "Cython<3.0" \
    && pip install --no-cache-dir --no-build-isolation pyyaml==5.4.0 \
    && pip install --no-cache-dir -r requirements.txt
EXPOSE 3001
ENTRYPOINT ["python", "app.py"]
