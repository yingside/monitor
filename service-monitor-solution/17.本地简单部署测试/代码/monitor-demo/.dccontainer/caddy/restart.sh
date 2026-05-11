docker run -d \
  --name monitor-caddy \
  --restart always \
  -p 3060:80 \
  -p 443:443 \
  -v $PWD/Caddyfile:/etc/caddy/Caddyfile \
  -v ./dist:/data \
  caddy:2.10.0