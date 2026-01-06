# =============================================================================
# Apollo A.I. Advanced - Frontend Docker Build
# Multi-stage build for Vite/React SPA
# =============================================================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source and build
COPY . .

# Build args for environment
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_API_URL

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Stage 2: Production with Nginx
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config for SPA routing
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    \
    # Gzip compression \
    gzip on; \
    gzip_vary on; \
    gzip_min_length 1024; \
    gzip_proxied expired no-cache no-store private auth; \
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript; \
    \
    # Cache static assets \
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ { \
    expires 1y; \
    add_header Cache-Control "public, immutable"; \
    } \
    \
    # SPA fallback - all routes go to index.html \
    location / { \
    try_files $uri $uri/ /index.html; \
    } \
    \
    # Health check endpoint \
    location /health { \
    access_log off; \
    return 200 "OK"; \
    add_header Content-Type text/plain; \
    } \
    }' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
