# ================================
# Stage 1: Builder
# ================================
FROM node:20-alpine3.20 AS builder

ENV NODE_ENV=build
WORKDIR /home/node

# Install system tools
RUN apk add --no-cache git python3 make g++

COPY package.json yarn.lock ./

# Set environment
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install all dependencies
RUN yarn install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Build app
RUN yarn run build

# Reinstall only production deps
RUN yarn install --production --frozen-lockfile --prefer-offline && \
    yarn cache clean

# ================================
# Stage 2: Runtime
# ================================
FROM node:20-alpine3.20 AS runtime

# Install Chromium + fonts
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Set environment
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    XDG_CONFIG_HOME=/tmp/.chromium \
    XDG_CACHE_HOME=/tmp/.chromium \
    NODE_ENV=production

# Create non-root user safely
RUN if ! getent group node > /dev/null; then addgroup -S node; fi && \
    if ! getent passwd node > /dev/null; then adduser -S node -G node; fi

USER node
WORKDIR /home/node

# Copy built files
COPY --from=builder /home/node/dist ./dist
COPY --from=builder /home/node/package*.json ./
COPY --from=builder /home/node/yarn.lock ./yarn.lock
COPY --from=builder /home/node/node_modules ./node_modules

CMD ["node", "dist/main.js"]