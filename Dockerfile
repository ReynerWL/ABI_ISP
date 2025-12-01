# ================================
# Stage 1: Builder
# ================================
FROM node:20-alpine3.20 AS builder

RUN sed -i 's|dl-cdn.alpinelinux.org|mirror.sg.gs|g' /etc/apk/repositories
RUN echo "https://mirror.leaseweb.net/alpine/v3.20/main" >> /etc/apk/repositories && \
    echo "https://mirror.leaseweb.net/alpine/v3.20/community" >> /etc/apk/repositories

ENV NODE_ENV=build
WORKDIR /app

RUN apk add --no-cache --virtual .build-deps \
    git python3 make g++

COPY package.json yarn.lock ./

# ❌ Jangan skip download Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

# Puppeteer akan download Chrome di sini → aman untuk WA
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build

RUN apk del .build-deps


# ================================
# Stage 2: Runtime
# ================================
FROM node:20-alpine3.20 AS runtime

# Chromium dependencies only — NOT chromium itself
RUN apk add --no-cache \
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
    libgcc \
    pango \
    atk \
    cairo \
    cups-libs \
    gdk-pixbuf \
    gtk+3.0

# Puppeteer env
ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=false

RUN addgroup -S app && adduser -S app -G app
USER app
WORKDIR /home/app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/yarn.lock ./yarn.lock

CMD ["node", "dist/main.js"]
