FROM node:20-bookworm-slim AS frontend-build

WORKDIR /src

COPY . /src

WORKDIR /src/immo-app
RUN npm ci
RUN if npm run build; then \
      echo "frontend build: OK"; \
    elif [ -f /src/backend/frontend_dist/index.html ]; then \
      echo "frontend build: ECHEC -> fallback backend/frontend_dist"; \
      rm -rf /src/immo-app/dist && mkdir -p /src/immo-app/dist && cp -a /src/backend/frontend_dist/. /src/immo-app/dist/; \
    else \
      echo "frontend build: ECHEC et aucun fallback backend/frontend_dist"; \
      exit 1; \
    fi


FROM python:3.12-slim

ARG BUILD_VERSION=dev
ARG BUILD_REF=local
ARG BUILD_TIME=unknown

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV APP_BUILD_VERSION=${BUILD_VERSION}
ENV APP_BUILD_REF=${BUILD_REF}
ENV APP_BUILD_TIME=${BUILD_TIME}

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
