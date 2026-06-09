FROM nginx:alpine

# Overlay files served at /_saddle/
COPY overlay/ /usr/share/nginx/saddle/

# nginx config template — RANCHER_URL is filled in at startup
COPY nginx/default.conf.template /etc/nginx/conf.d/default.conf.template

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
