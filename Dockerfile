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

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY index.js ./
COPY src ./src

# Chạy bằng user không đặc quyền có sẵn trong image node.
USER node

EXPOSE 3000

CMD ["node", "index.js"]
