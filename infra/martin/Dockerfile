FROM ghcr.io/maplibre/martin:latest

COPY martin.yaml /config/martin.yaml
COPY entrypoint.sh /entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/entrypoint.sh"]
