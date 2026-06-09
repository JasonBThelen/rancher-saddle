FROM nginx:alpine

# gettext provides envsubst for RANCHER_URL substitution in the nginx template
RUN apk add --no-cache gettext

# Overlay files served at /_saddle/
COPY overlay/ /usr/share/nginx/saddle/

# nginx config template — RANCHER_URL is filled in at startup
COPY nginx/default.conf.template /etc/nginx/conf.d/default.conf.template

COPY docker-entrypoint.sh /docker-entrypoint.sh
# Strip Windows CRLF if the file was checked out on Windows, then set executable
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
