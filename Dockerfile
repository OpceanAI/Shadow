# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# Stage 2: Production
FROM node:22-alpine AS production

RUN addgroup -g 1001 shadow && \
    adduser -u 1001 -G shadow -s /bin/sh -D shadow

WORKDIR /app

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

RUN chown -R shadow:shadow /app

USER shadow

ENTRYPOINT ["node", "dist/index.js"]
CMD ["--help"]
