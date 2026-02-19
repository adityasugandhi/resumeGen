FROM python:3.11-slim
WORKDIR /app
RUN pip install --no-cache-dir fastapi uvicorn lancedb pyarrow numpy
COPY lancedb-server.py .
ENV LANCEDB_DATA_PATH=/data/lancedb
ENV LANCEDB_PORT=8002
EXPOSE 8002
VOLUME /data/lancedb
CMD ["python", "lancedb-server.py"]
