# ================================
# Stage 1: Builder (with resource optimizations)
# ================================
FROM node:20-alpine AS builder

ENV NODE_ENV=build

WORKDIR /home/node

# Install minimal build tools (only what's needed for node-gyp if any native deps exist)
RUN apk add --no-cache python3 make g++ git

# Copy package files first (to leverage Docker cache)
COPY package.json yarn.lock ./

# Set environment for Puppeteer (to avoid downloading Chromium in this stage)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Install ALL dependencies (including dev)
RUN yarn install --frozen-lockfile --ignore-scripts

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
FROM node:20-alpine AS runtime

# Install system dependencies in a single layer (reduces size)
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dumb-init && \
    # Create non-root user
    addgroup -S -g 1001 node && \
    adduser -S -u 1001 node

# Set Puppeteer environment variables
ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    XDG_CONFIG_HOME=/tmp/.config \
    XDG_CACHE_HOME=/tmp/.cache

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