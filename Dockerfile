FROM nginx:alpine

# Copy the static web application files into the default nginx document root
COPY app/ /usr/share/nginx/html/

# Expose port 80 for traffic
EXPOSE 80
