FROM node:20-alpine AS shared-builder
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci
COPY packages/shared/ packages/shared/
RUN npm run build -w packages/shared

FROM node:20-alpine AS web-builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/web/package.json packages/web/package.json
RUN npm ci
COPY --from=shared-builder /app/packages/shared/dist ./packages/shared/dist
COPY packages/web/ packages/web/
RUN npm run build -w packages/web

FROM nginx:alpine AS runner
COPY --from=web-builder /app/packages/web/dist /usr/share/nginx/html
COPY packages/web/nginx.conf /etc/nginx/conf.d/default.conf
RUN echo "user  nginx; worker_processes  auto; error_log  /var/log/nginx/error.log warn; pid /var/run/nginx.pid; events { multi_accept on; use epoll; worker_connections 1024; } http { include /etc/nginx/mime.types; default_type application/octet-stream; server_tokens off; client_max_body_size 10M; include /etc/nginx/conf.d/*.conf; }" > /etc/nginx/nginx.conf
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=10s \
  CMD wget --spider http://localhost:80/ || exit 1
CMD ["nginx", "-g", "daemon off;"]
