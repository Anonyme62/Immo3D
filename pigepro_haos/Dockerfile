FROM node:20-bookworm-slim AS frontend-build

WORKDIR /src

COPY . /src

WORKDIR /src/immo-app
RUN npm ci
RUN npm run build


FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

WORKDIR /app

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend
COPY --from=frontend-build /src/immo-app/dist /app/backend/frontend_dist
COPY run.sh /run.sh

RUN chmod +x /run.sh && mkdir -p /data/backups

WORKDIR /app/backend

EXPOSE 10000

CMD ["/run.sh"]
