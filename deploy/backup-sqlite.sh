#!/usr/bin/env bash
# Backup da base de dados da arcada (SQLite, no volume marquitos-arcade-home), todas as noites às 03:15 pelo cron do
# servidor (/etc/cron.d/marquitos-arcade-backup, como o utilizador deploy), antes do backup do servidor feito pelo
# fornecedor. O workflow deploy-vds.yml copia este script para /opt/marquitos-arcade.
#
# Usa o ".backup" do sqlite3, que tira uma cópia consistente mesmo com a arcada a escrever (copiar o ficheiro à mão
# não é seguro), num contentor alpine de passagem: a imagem da arcada não tem o sqlite3. Guarda os últimos 14 dias.
#
# Para repor um backup (com a arcada parada, para nada escrever por cima):
#   cd /opt/marquitos-arcade && docker compose stop
#   docker run --rm -v marquitos-arcade-home:/data -v /var/backups/marquitos-arcade:/backup alpine:3.22 \
#     sh -c 'gunzip -c /backup/app-AAAAMMDD-HHMMSS.db.gz > /data/app.db && rm -f /data/app.db-wal /data/app.db-shm && chown 1654:1654 /data/app.db'
# (1654 é o utilizador app das imagens .NET; o -wal e o -shm são do modo WAL e pertencem à base de dados anterior)
#   docker compose start
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/marquitos-arcade}"
KEEP_DAYS="${KEEP_DAYS:-14}"
stamp="$(date +%Y%m%d-%H%M%S)"

docker run --rm \
  -v marquitos-arcade-home:/data \
  -v "$BACKUP_DIR:/backup" \
  alpine:3.22 \
  sh -c "apk add --no-cache --quiet sqlite && sqlite3 /data/app.db '.backup /backup/app-$stamp.db' && gzip /backup/app-$stamp.db"

find "$BACKUP_DIR" -name 'app-*.db.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) app-$stamp.db.gz ($(du -h "$BACKUP_DIR/app-$stamp.db.gz" | cut -f1))"
