FROM --platform=linux/amd64 debian:bookworm-slim
RUN apt-get update \
 && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      libvips-tools openslide-tools awscli curl jq ca-certificates \
 && rm -rf /var/lib/apt/lists/*
# Fail the image build if distro vips lacks OpenSlide -- the same check
# scripts/prepare-tiling-snapshot.mjs used to run by hand.
RUN vips -l | grep -qi openslideload
COPY run-tiling.sh /app/run-tiling.sh
RUN chmod +x /app/run-tiling.sh
ENTRYPOINT ["/app/run-tiling.sh"]
