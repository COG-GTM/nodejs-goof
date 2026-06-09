FROM python:3.11-slim
RUN mkdir /usr/src/goof && mkdir /tmp/extracted_files
COPY . /usr/src/goof
WORKDIR /usr/src/goof
RUN pip install --no-cache-dir -r requirements.txt
EXPOSE 3001
ENTRYPOINT ["python", "app.py"]
