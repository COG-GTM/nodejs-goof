FROM python:3.12-slim

RUN mkdir -p /usr/src/goof /tmp/extracted_files
WORKDIR /usr/src/goof

COPY requirements.txt /usr/src/goof/
RUN pip install --no-cache-dir -r requirements.txt

COPY . /usr/src/goof

EXPOSE 3001
ENTRYPOINT ["python", "app.py"]
