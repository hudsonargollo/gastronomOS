# GastronomOS Backend - Development Docker Image
# Note: This is for local development only. Production deploys to Cloudflare Workers.

FROM node:20-alpine AS base

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat

# Development stage
FROM base AS development
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Generate TypeScript types
RUN npm run build || true

# Expose port for local development
EXPOSE 8787

# Start development server
CMD ["npm", "run", "dev"]

# Builder stage for production builds
FROM base AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build || true

# Production stage (minimal image for artifacts)
FROM base AS production
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Note: Production deployment uses Cloudflare Workers, not Docker
# This stage is for building artifacts only
CMD ["echo", "Production deployment uses Cloudflare Workers. Use 'npm run deploy:prod' instead."]