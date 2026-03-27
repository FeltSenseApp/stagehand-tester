# Build stage
FROM oven/bun:1-debian AS builder

WORKDIR /app

# Build-time args for secrets/config; also exported to runtime env for the app.
ARG PORT=8080 \
    PORTAL_URL="" \
    PORTAL_USERNAME="" \
    PORTAL_PASSWORD="" \
    LINEAR_WEBHOOK_SECRET="" \
    LINEAR_API_KEY="" \
    BROWSERBASE_API_KEY="" \
    BROWSERBASE_PROJECT_ID="" \
    MAX_CONCURRENT_TESTS=""

ENV PORT=${PORT} \
    PORTAL_URL=${PORTAL_URL} \
    PORTAL_USERNAME=${PORTAL_USERNAME} \
    PORTAL_PASSWORD=${PORTAL_PASSWORD} \
    LINEAR_WEBHOOK_SECRET=${LINEAR_WEBHOOK_SECRET} \
    LINEAR_API_KEY=${LINEAR_API_KEY} \
    BROWSERBASE_API_KEY=${BROWSERBASE_API_KEY} \
    BROWSERBASE_PROJECT_ID=${BROWSERBASE_PROJECT_ID} \
    MAX_CONCURRENT_TESTS=${MAX_CONCURRENT_TESTS}

# Copy package files and lockfile
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN bun run build

# Production stage: Debian-based image for Chrome
FROM oven/bun:1-debian

# Install Chrome dependencies
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install Chrome
RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-linux-signing-key.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-linux-signing-key.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Copy static files
COPY public ./public

# Copy test files (required for E2E test runner)
COPY tests ./tests
COPY vitest.config.ts ./

# Create directories for test results and screenshots
RUN mkdir -p test-results screenshots && chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port (default 8080, can be overridden by PORT build arg)
EXPOSE ${PORT}

# Note: Sevalla uses its own Liveness/Readiness probes configured in the dashboard
# Docker HEALTHCHECK is ignored by Sevalla, so we don't include it here

# Start the app with Bun
CMD ["bun", "run", "dist/index.js"]
