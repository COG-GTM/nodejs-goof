#!/usr/bin/env bash
# Moves nodejs-goof data from the source datastores to fresh targets and compares record counts.
#   MongoDB: mongodump | mongorestore (express-todo)
#   MySQL:   mysqldump | mysql (acme)
#   Bucket:  mc mirror into MinIO, only when SRC_S3_URL is set (the app has no bucket today)
# Tools run in containers on DOCKER_NETWORK, so only docker is needed on the host.
# Exits non-zero on any failed copy, failed count query or count mismatch.
# Passwords are read from the environment by name and never printed.
set -euo pipefail

DOCKER_NETWORK="${DOCKER_NETWORK:-goofmig_default}"
TARGET_PREFIX="${TARGET_PREFIX:-goof-target}"

SRC_MONGO_URI="${SRC_MONGO_URI:-mongodb://mongo:27017/express-todo}"
MONGO_DB="${MONGO_DB:-express-todo}"
SRC_MYSQL_HOST="${SRC_MYSQL_HOST:-mysql}"
SRC_MYSQL_PORT="${SRC_MYSQL_PORT:-3306}"
SRC_MYSQL_USER="${SRC_MYSQL_USER:-root}"
: "${SRC_MYSQL_PASSWORD:?set SRC_MYSQL_PASSWORD}"
MYSQL_DB="${MYSQL_DB:-acme}"

# Targets: leave TGT_* unset to start fresh local containers; set them to point at the platform claims.
TGT_MONGO_URI="${TGT_MONGO_URI:-}"
TGT_MYSQL_HOST="${TGT_MYSQL_HOST:-}"
TGT_MYSQL_PORT="${TGT_MYSQL_PORT:-3306}"
TGT_MYSQL_USER="${TGT_MYSQL_USER:-root}"
TGT_MYSQL_PASSWORD="${TGT_MYSQL_PASSWORD:-$SRC_MYSQL_PASSWORD}"

MONGO_IMAGE="${MONGO_IMAGE:-mongo:3.6}"
MYSQL_IMAGE="${MYSQL_IMAGE:-mysql:5.7}"
MC_IMAGE="${MC_IMAGE:-cgr.dev/chainguard/minio-client:latest}"

log() { printf '[migrate-data] %s\n' "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }
valid_name() { [[ "$1" =~ ^[A-Za-z0-9_-]+$ ]]; }
valid_name "$MONGO_DB" || die "MONGO_DB must match [A-Za-z0-9_-]+"
valid_name "$MYSQL_DB" || die "MYSQL_DB must match [A-Za-z0-9_-]+"
mongo_tool() { docker run --rm -i --network "$DOCKER_NETWORK" "$MONGO_IMAGE" "$@"; }
mysql_tool() { docker run --rm -i --network "$DOCKER_NETWORK" -e MYSQL_PWD "$MYSQL_IMAGE" "$@"; }

start_targets() {
  if [ -z "$TGT_MONGO_URI" ]; then
    log "starting fresh MongoDB target ${TARGET_PREFIX}-mongo"
    docker rm -f "${TARGET_PREFIX}-mongo" >/dev/null 2>&1 || true
    docker run -d --name "${TARGET_PREFIX}-mongo" --network "$DOCKER_NETWORK" "$MONGO_IMAGE" >/dev/null
    TGT_MONGO_URI="mongodb://${TARGET_PREFIX}-mongo:27017/${MONGO_DB}"
    until mongo_tool mongo --quiet "$TGT_MONGO_URI" --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1; do sleep 2; done
  fi
  if [ -z "$TGT_MYSQL_HOST" ]; then
    log "starting fresh MySQL target ${TARGET_PREFIX}-mysql"
    docker rm -f "${TARGET_PREFIX}-mysql" >/dev/null 2>&1 || true
    MYSQL_ROOT_PASSWORD="$TGT_MYSQL_PASSWORD" docker run -d --name "${TARGET_PREFIX}-mysql" --network "$DOCKER_NETWORK" \
      --platform linux/amd64 -e MYSQL_ROOT_PASSWORD "$MYSQL_IMAGE" >/dev/null
    TGT_MYSQL_HOST="${TARGET_PREFIX}-mysql"
    until MYSQL_PWD="$TGT_MYSQL_PASSWORD" mysql_tool mysqladmin -h "$TGT_MYSQL_HOST" -P "$TGT_MYSQL_PORT" -u "$TGT_MYSQL_USER" ping >/dev/null 2>&1; do sleep 2; done
    sleep 3
  fi
}

move_mongo() {
  log "MongoDB: dump ${MONGO_DB} from source, restore into target"
  mongo_tool mongodump --uri "$SRC_MONGO_URI" --archive --quiet \
    | mongo_tool mongorestore --uri "$TGT_MONGO_URI" --archive --drop --quiet
}

move_mysql() {
  log "MySQL: dump ${MYSQL_DB} from source, restore into target"
  MYSQL_PWD="$SRC_MYSQL_PASSWORD" mysql_tool mysqldump -h "$SRC_MYSQL_HOST" -P "$SRC_MYSQL_PORT" -u "$SRC_MYSQL_USER" \
      --single-transaction --routines --triggers --databases "$MYSQL_DB" \
    | MYSQL_PWD="$TGT_MYSQL_PASSWORD" mysql_tool mysql -h "$TGT_MYSQL_HOST" -P "$TGT_MYSQL_PORT" -u "$TGT_MYSQL_USER"
}

# mc reads aliases from MC_HOST_<alias>=<scheme>://<key>:<secret>@<host>; the image has no shell.
mc_host() { local u="$1"; printf '%s://%s:%s@%s' "${u%%://*}" "$2" "$3" "${u#*://}"; }
mc_tool() {
  MC_HOST_src="$(mc_host "$SRC_S3_URL" "$SRC_S3_ACCESS_KEY" "$SRC_S3_SECRET_KEY")" \
  MC_HOST_tgt="$(mc_host "$TGT_S3_URL" "$TGT_S3_ACCESS_KEY" "$TGT_S3_SECRET_KEY")" \
    docker run --rm --network "$DOCKER_NETWORK" -e MC_HOST_src -e MC_HOST_tgt "$MC_IMAGE" "$@"
}

move_bucket() {
  if [ -z "${SRC_S3_URL:-}" ]; then
    log "bucket: none configured for this app (SRC_S3_URL unset), nothing to mirror"
    return
  fi
  : "${SRC_S3_BUCKET:?}" "${SRC_S3_ACCESS_KEY:?}" "${SRC_S3_SECRET_KEY:?}"
  : "${TGT_S3_URL:?}" "${TGT_S3_BUCKET:?}" "${TGT_S3_ACCESS_KEY:?}" "${TGT_S3_SECRET_KEY:?}"
  log "bucket: mc mirror ${SRC_S3_BUCKET} -> MinIO ${TGT_S3_BUCKET}"
  mc_tool mb -p "tgt/$TGT_S3_BUCKET" >/dev/null
  mc_tool mirror --overwrite "src/$SRC_S3_BUCKET" "tgt/$TGT_S3_BUCKET" >/dev/null
}

mongo_counts() {
  mongo_tool mongo --quiet "$1" --eval \
    'db.getCollectionNames().filter(function(c){return c.indexOf("system.")!==0}).sort().forEach(function(c){print(c+"\t"+db.getCollection(c).count())})'
}

mysql_counts() {
  local host="$1" port="$2" user="$3" pw="$4" tables t n
  tables="$(MYSQL_PWD="$pw" mysql_tool mysql -h "$host" -P "$port" -u "$user" -N -B \
    -e "SELECT table_name FROM information_schema.tables WHERE table_schema='${MYSQL_DB}' AND table_type='BASE TABLE' ORDER BY table_name")" || return 1
  for t in $tables; do
    valid_name "$t" || { log "unexpected table name: $t"; return 1; }
    n="$(MYSQL_PWD="$pw" mysql_tool mysql -h "$host" -P "$port" -u "$user" -N -B -e "SELECT COUNT(*) FROM \`${MYSQL_DB}\`.\`$t\`")" || return 1
    printf '%s\t%s\n' "$t" "$n"
  done
}

bucket_count() {
  local listing
  listing="$(mc_tool ls --recursive "$1/$2")" || return 1
  printf '%s\n' "$listing" | grep -c . || true
}

# Compares every name present on either side; a name missing on one side is a mismatch.
compare() {
  local kind="$1" src="$2" tgt="$3" status=0 name n m
  [ -n "$src" ] || { log "$kind: source returned no collections/tables"; return 1; }
  while read -r name; do
    [ -z "$name" ] && continue
    n="$(printf '%s\n' "$src" | awk -F'\t' -v k="$name" '$1==k{print $2}')"
    m="$(printf '%s\n' "$tgt" | awk -F'\t' -v k="$name" '$1==k{print $2}')"
    printf '%-7s %-20s source=%-6s target=%-6s %s\n' "$kind" "$name" "${n:-missing}" "${m:-missing}" \
      "$([ -n "$n" ] && [ "$n" = "$m" ] && echo match || echo MISMATCH)"
    { [ -n "$n" ] && [ "$n" = "$m" ]; } || status=1
  done < <(printf '%s\n%s\n' "$src" "$tgt" | cut -f1 | sort -u)
  return $status
}

main() {
  start_targets
  move_mongo
  move_mysql
  move_bucket

  local rc=0 ms mt ys yt so to
  ms="$(mongo_counts "$SRC_MONGO_URI")" || die "MongoDB source count failed"
  mt="$(mongo_counts "$TGT_MONGO_URI")" || die "MongoDB target count failed"
  ys="$(mysql_counts "$SRC_MYSQL_HOST" "$SRC_MYSQL_PORT" "$SRC_MYSQL_USER" "$SRC_MYSQL_PASSWORD")" || die "MySQL source count failed"
  yt="$(mysql_counts "$TGT_MYSQL_HOST" "$TGT_MYSQL_PORT" "$TGT_MYSQL_USER" "$TGT_MYSQL_PASSWORD")" || die "MySQL target count failed"
  echo "== record counts"
  compare mongodb "$ms" "$mt" || rc=1
  compare mysql "$ys" "$yt" || rc=1
  if [ -n "${SRC_S3_URL:-}" ]; then
    so="$(bucket_count src "$SRC_S3_BUCKET")" || die "source bucket listing failed"
    to="$(bucket_count tgt "$TGT_S3_BUCKET")" || die "target bucket listing failed"
    printf '%-7s %-20s source=%-6s target=%-6s %s\n' objects "$SRC_S3_BUCKET" "$so" "$to" "$([ "$so" = "$to" ] && echo match || echo MISMATCH)"
    [ "$so" = "$to" ] || rc=1
  else
    echo "objects (no bucket)          source=0      target=0      n/a"
  fi
  [ $rc -eq 0 ] && echo "RESULT: match" || echo "RESULT: mismatch"
  return $rc
}

main "$@"
