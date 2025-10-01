# ================================
# Stage 1: Get oauth2l binary
# ================================
FROM gcr.io/oauth2l/oauth2l AS auth-tool

# ================================
# Stage 2: Builder
# ================================
FROM node:20-slim AS app-builder

ENV NODE_ENV=build

WORKDIR /home/node

# Install build tools
RUN apt-get update && \
    apt-get install -y python3 build-essential git && \
    rm -rf /var/lib/apt/lists/*

# Copy package files only
COPY package.json yarn.lock ./

# Set environment
ENV HUSKY=0 \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Install ALL dependencies
RUN yarn install --frozen-lockfile --ignore-scripts

# Copy source code
COPY . .

# Build app
RUN yarn run build

# Cleanup
RUN rm -rf \
    node_modules/.cache \
    __tests__ \
    coverage \
    docs \
    examples \
    *.log \
    && yarn cache clean

# ================================
# Stage 3: Final Runtime
# ================================
FROM node:20-slim AS app-runner

ENV NODE_ENV=production

USER root
WORKDIR /home/node

# ✅ Copy oauth2l from 'auth-tool'
COPY --from=auth-tool /bin/oauth2l /bin/oauth2l

# ✅ Copy dist only
COPY --from=app-builder /home/node/dist ./dist

# ✅ Install system deps
RUN apt-get update && \
    apt-get install -y git curl chromium && \
    apt-get autoremove -y && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# ✅ Reinstall only production dependencies
RUN yarn install --production --frozen-lockfile --prefer-offline && \
    yarn cache clean && \
    mkdir -p ~/.config

# Switch to non-root user
USER node

# Puppeteer settings
ENV PUPPETEER_SKIP_DOWNLOAD=false \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    XDG_CONFIG_HOME=/tmp/.chromium \
    XDG_CACHE_HOME=/tmp/.chromium

CMD ["node", "dist/main.js"]