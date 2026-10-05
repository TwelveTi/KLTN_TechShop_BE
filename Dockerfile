# syntax=docker/dockerfile:1

# Backend TechShop. Không có bước build, chỉ cần cài phụ thuộc production.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
# Bind mọi giao diện mạng.
ENV HOST_NAME=0.0.0.0

# Vá gói hệ thống (OpenSSL) và gỡ npm/npx/corepack: image chạy bằng `node`, không cần
# trình quản lý gói, mà bản npm đóng kèm là nơi Trivy báo toàn bộ lỗ hổng HIGH/CRITICAL.
RUN apk upgrade --no-cache \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
     /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY index.js ./
COPY src ./src

# Chạy bằng user không đặc quyền có sẵn trong image node.
USER node

EXPOSE 3000

CMD ["node", "index.js"]
