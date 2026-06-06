# Static site served by a tiny nginx image (~25 MB).
FROM nginx:alpine
COPY default.conf /etc/nginx/conf.d/default.conf
COPY public /usr/share/nginx/html
EXPOSE 8080
