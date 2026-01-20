#!/bin/bash
set -e

# Fix SSH key permissions (copy from read-only mount and fix ownership)
if [ -d /root/.ssh ] && [ -n "$(ls -A /root/.ssh 2>/dev/null)" ]; then
    # Create writable SSH directory in /root
    mkdir -p /root/.ssh-writable
    cp -r /root/.ssh/* /root/.ssh-writable/ 2>/dev/null || true
    chown -R root:root /root/.ssh-writable
    chmod 700 /root/.ssh-writable
    chmod 600 /root/.ssh-writable/* 2>/dev/null || true
    chmod 644 /root/.ssh-writable/*.pub 2>/dev/null || true
    chmod 644 /root/.ssh-writable/known_hosts 2>/dev/null || true
    
    # Set GIT_SSH_COMMAND with correct key path
    if [ -f /root/.ssh-writable/id_rsa ]; then
        export GIT_SSH_COMMAND="ssh -i /root/.ssh-writable/id_rsa -o StrictHostKeyChecking=accept-new"
    elif [ -f /root/.ssh-writable/id_ed25519 ]; then
        export GIT_SSH_COMMAND="ssh -i /root/.ssh-writable/id_ed25519 -o StrictHostKeyChecking=accept-new"
    fi
fi

# Configure git safe.directory for /app (use writable config file)
# Since /root/.gitconfig is read-only, we'll use a separate config file
mkdir -p /root/.config/git
git config --file /root/.config/git/config --add safe.directory /app
export GIT_CONFIG_GLOBAL=/root/.config/git/config

# Execute the original command
exec "$@"
