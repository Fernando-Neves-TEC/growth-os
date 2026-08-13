# Growth OS — workers Python (design/simulação)
FROM python:3.12-slim

WORKDIR /app

# Dependências de desenvolvimento (pytest) — cacheadas no build
COPY requirements.txt requirements-dev.txt ./
RUN pip install --no-cache-dir -r requirements-dev.txt

COPY src ./src
COPY tests ./tests

CMD ["python", "-m", "pytest", "tests", "-q"]
