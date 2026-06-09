FROM node:20-alpine AS builder
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/backend/package.json packages/backend/package.json
RUN npm ci

COPY packages/shared/ packages/shared/
COPY packages/backend/ packages/backend/
RUN npm run build -w packages/shared
RUN npm run build -w packages/backend

FROM node:20-alpine AS runner
RUN apk add --no-cache build-base python3
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/backend/package.json ./packages/backend/package.json
COPY --from=builder /app/packages/backend/node_modules ./packages/backend/node_modules
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist
RUN npm rebuild bcrypt && npm rebuild msgpackr-extract
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=10s --retries=3 --start-period=30s \
  CMD node -e "require('http').get('http://localhost:3001/health', r => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"
CMD ["node", "packages/backend/dist/index.js"]
