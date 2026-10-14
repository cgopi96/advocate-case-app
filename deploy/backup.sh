#!/bin/sh
# Runs inside the backup container: a database dump (which includes uploaded
# documents) once a day at 02:00 IST, keeping KEEP_DAYS days.
set -eu
# Give the app time to apply migrations before the first backup.
sleep 300
while true; do
  now_ist=$(TZ=Asia/Kolkata date +%H%M)
  if [ "$now_ist" = "0200" ] || [ ! -f /backups/.first-done ]; then
    stamp=$(TZ=Asia/Kolkata date +%Y-%m-%d_%H%M)
    pg_dump -Fc -f "/backups/db_$stamp.dump"
    touch /backups/.first-done
    find /backups -name 'db_*.dump' -mtime +"$KEEP_DAYS" -delete
    echo "Backup $stamp done"
    sleep 61
  fi
  sleep 30
done
