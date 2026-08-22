#!/usr/bin/env bash

# Maven Central occasionally rate-limits shared GitHub runner IPs with HTTP 429.
# Successful downloads remain in Gradle's cache, so bounded backoff lets the
# next attempt continue without hiding a real compile or test failure forever.

set -u

max_attempts=4
attempt=1

while true; do
  echo "Gradle attempt ${attempt}/${max_attempts}: ./gradlew $*"
  if ./gradlew "$@" --no-daemon --max-workers=2; then
    exit 0
  fi

  if [ "$attempt" -ge "$max_attempts" ]; then
    echo "::error::Gradle failed after ${max_attempts} attempts. See the final error above."
    exit 1
  fi

  case "$attempt" in
    1) delay_seconds=20 ;;
    2) delay_seconds=45 ;;
    *) delay_seconds=90 ;;
  esac
  echo "::warning::Gradle dependency/build attempt failed. Retrying in ${delay_seconds}s; completed downloads stay cached."
  sleep "$delay_seconds"
  attempt=$((attempt + 1))
done
