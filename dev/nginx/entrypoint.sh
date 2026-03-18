#!/bin/sh

mkdir -p /etc/nginx/certs

if [ ! -f "/etc/nginx/certs/server.crt" ]; then
    echo "Generating self-signed certificate for localhost..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout /etc/nginx/certs/server.key \
        -out /etc/nginx/certs/server.crt \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
fi

exec nginx -g "daemon off;"
