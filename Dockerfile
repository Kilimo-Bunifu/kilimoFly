FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY index.html .
COPY scripts/ ./scripts/
COPY style/ ./style/
COPY api/ ./api/

ENV PORT=8765
EXPOSE 8765

CMD ["python", "api/main.py"]
