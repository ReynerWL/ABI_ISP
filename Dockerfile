# ================================
# Stage 1: Builder
# ================================
FROM node:20-alpine3.20 AS builder

# Pakai mirror resmi saja, stabil
RUN sed -i 's|dl-cdn.alpinelinux.org|dl-cdn.alpinelinux.org|g' /etc/apk/repositories

ENV NODE_ENV=build
WORKDIR /app

RUN apk add --no-cache --virtual .build-deps git python3 make g++

COPY package.json yarn.lock ./

# INI PENTING: puppeteer download Chromium!!!
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build

RUN apk del .build-deps


# ================================
# Stage 2: Runtime — Alpine 3.18
# ================================
FROM node:20-alpine3.18 AS runtime

# Pakai mirror resmi Alpine
RUN sed -i 's|dl-cdn.alpinelinux.org|dl-cdn.alpinelinux.org|g' /etc/apk/repositories

# Install Chromium from Alpine repository (OFFICIAL)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    libstdc++ \
    libx11 \
    libxcomposite \
    libxdamage \
    libxfixes \
    libxrandr \
    libxrender \
    libxkbcommon \
    pango \
    cairo \
    gdk-pixbuf \
    gtk+3.0

ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    XDG_CONFIG_HOME=/tmp/.chromium \
    XDG_CACHE_HOME=/tmp/.chromium

RUN addgroup -S app && adduser -S app -G app
USER app
WORKDIR /home/app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/yarn.lock ./yarn.lock

CMD ["node", "dist/main.js"]
