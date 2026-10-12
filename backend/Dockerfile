FROM python:3.12-alpine AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN apk upgrade --no-cache && pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -r requirements.txt && addgroup -g 10001 appuser && adduser -D -u 10001 -G appuser appuser
COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app
USER 10001:10001
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

FROM base AS test
USER root
COPY requirements-dev.txt .
RUN pip install --no-cache-dir -r requirements-dev.txt
COPY tests ./tests
COPY pytest.ini .
USER 10001:10001
CMD ["pytest", "-v", "-p", "no:cacheprovider"]

FROM base AS runtime
USER root
# Build tooling is unnecessary in the deployed image; remove its vendored libraries too.
RUN python -m pip uninstall -y pip setuptools wheel && rm -rf /usr/local/lib/python3.12/ensurepip
USER 10001:10001
