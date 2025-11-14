# ================================
# Stage 1: Builder
# ================================
FROM node:20-alpine3.20 AS builder

# ✅ Correct mirror (no duplicate /alpine)
RUN sed -i 's|dl-cdn.alpinelinux.org|mirror.sg.gs|g' /etc/apk/repositories

# Optional fallback (if first mirror fails)
RUN echo "https://mirror.leaseweb.net/alpine/v3.20/main" >> /etc/apk/repositories && \
    echo "https://mirror.leaseweb.net/alpine/v3.20/community" >> /etc/apk/repositories

# Set build environment
ENV NODE_ENV=build
WORKDIR /app

# Install essential build tools (for native modules)
RUN apk add --no-cache --virtual .build-deps \
    git \
    python3 \
    make \
    g++

# Copy dependency files first for caching
COPY package.json yarn.lock ./

# Skip downloading Chromium during install
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Install dependencies
RUN yarn install --frozen-lockfile --ignore-scripts

# Copy all source files
COPY . .

# Build the app (NestJS/Next/etc.)
RUN yarn build

# Remove dev dependencies and build tools for smaller final image
RUN yarn install --production --frozen-lockfile --prefer-offline && \
    yarn cache clean && \
    apk del .build-deps


# ================================
# Stage 2: Runtime
# ================================
FROM node:20-alpine3.20 AS runtime

# ✅ Use the same reliable mirrors for runtime
RUN sed -i 's|dl-cdn.alpinelinux.org|mirror.sg.gs|g' /etc/apk/repositories && \
    echo "https://mirror.leaseweb.net/alpine/v3.20/main" >> /etc/apk/repositories && \
    echo "https://mirror.leaseweb.net/alpine/v3.20/community" >> /etc/apk/repositories

# Install Chromium and minimal dependencies
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Environment configuration for Puppeteer
ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    XDG_CONFIG_HOME=/tmp/.chromium \
    XDG_CACHE_HOME=/tmp/.chromium

# Create non-root user (safer for production)
RUN addgroup -S app && adduser -S app -G app
USER app
WORKDIR /home/app

# Copy from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/yarn.lock ./yarn.lock
COPY --from=builder /app/node_modules ./node_modules

# Default command
CMD ["node", "dist/main.js"]
