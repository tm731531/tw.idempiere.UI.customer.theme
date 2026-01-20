FROM oven/bun:latest

# Set environment
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=development

WORKDIR /app

# Install system dependencies (git, curl for opencode)
RUN apt-get update && \
    apt-get install -y curl git ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Install opencode
RUN curl -fsSL https://opencode.ai/install | bash

# Set up PATH
ENV PATH="/root/.bun/bin:/root/.opencode/bin:$PATH"

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

# Copy package files (not lockfile, as arch differs between dev/prod)
COPY ui/package.json ./

# Install dependencies with bun
RUN bun install

# Copy source code
COPY ui/ ./

# Expose ports
EXPOSE 5173 8888 5555

# Default command (can be overridden by docker-compose)
CMD ["bun", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
