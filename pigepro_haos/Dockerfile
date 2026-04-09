FROM node:20-bookworm-slim AS frontend-build

WORKDIR /build/immo-app

COPY immo-app/package*.json ./
RUN npm ci

COPY immo-app/ ./
RUN npm run build


FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend
COPY --from=frontend-build /build/immo-app/dist /app/backend/frontend_dist
COPY pigepro_haos/run.sh /run.sh

RUN chmod +x /run.sh && mkdir -p /data/backups

WORKDIR /app/backend

EXPOSE 10000

CMD ["/run.sh"]
