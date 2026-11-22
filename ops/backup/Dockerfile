FROM postgres:18-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends awscli gpg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY ops/backup/run.sh /usr/local/bin/varello-backup
RUN chmod 755 /usr/local/bin/varello-backup
USER postgres
CMD ["/usr/local/bin/varello-backup"]
