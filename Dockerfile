# ================================
# Stage 1: Builder (using Debian for stability)
# ================================
FROM node:20-slim AS builder

ENV NODE_ENV=build

WORKDIR /home/node

# Install minimal build tools (only what's needed for node-gyp if any native deps exist)
# Note: No need for python/make/g++ if no native modules are installed
# If you have native deps (e.g., bcrypt, sharp), uncomment these:
# RUN apt-get update && apt-get install -y python3 build-essential git

# Copy package files first (to leverage Docker cache)
COPY package.json yarn.lock ./

# Set environment for Puppeteer (to avoid downloading Chromium in this stage)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install ALL dependencies
# ✅ Use Debian's stable crypto libraries
RUN yarn install --frozen-lockfile --ignore-scripts --network-timeout 100000

# Copy source code
COPY . .

# Build app
RUN yarn run build

# Cleanup build-time dependencies (to reduce layer size)
RUN yarn install --production --frozen-lockfile --ignore-scripts && \
    yarn cache clean --force

# ================================
# Stage 2: Final Runtime Image
# ================================
FROM node:20-slim AS runtime

# Install system dependencies in a single layer (reduces size)
# ✅ Install Chromium and fonts
RUN apt-get update && \
    apt-get install -y \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libxss1 \
    libgtk-3-0 \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer environment variables
ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    XDG_CONFIG_HOME=/tmp/.config \
    XDG_CACHE_HOME=/tmp/.cache

# Create non-root user
RUN groupadd -r node && useradd -r -g node node

USER node
WORKDIR /home/node

# Copy built artifacts from builder
COPY --from=builder --chown=node:node /home/node/dist ./dist
COPY --from=builder --chown=node:node /home/node/package*.json ./
COPY --from=builder --chown=node:node /home/node/yarn.lock ./
COPY --from=builder --chown=node:node /home/node/node_modules ./node_modules

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]