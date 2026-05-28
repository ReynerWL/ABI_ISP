# ================================
# Stage 1: Builder
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache --virtual .build-deps git python3 make g++

COPY package.json yarn.lock ./

RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build

RUN apk del .build-deps

# ================================
# Stage 2: Runtime
# ================================
FROM node:20-alpine AS runtime

ENV NODE_ENV=production

RUN addgroup -S app && adduser -S app -G app
USER app
WORKDIR /home/app

# Pre-create the baileys auth directory so it has correct permissions
# when running in k3s. You should mount your PVC to /home/app/baileys_auth_info
RUN mkdir -p /home/app/baileys_auth_info

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/yarn.lock ./yarn.lock

CMD ["node", "dist/main.js"]
