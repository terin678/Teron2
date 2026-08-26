FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html 3d.html /usr/share/nginx/html/
COPY lib /usr/share/nginx/html/lib
COPY assets /usr/share/nginx/html/assets
COPY src /usr/share/nginx/html/src
