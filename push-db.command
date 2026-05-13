#!/bin/bash
cd "$(dirname "$0")"

echo "Migration adı yaz:"
read MIGRATION_NAME

npx prisma migrate dev --name "$MIGRATION_NAME"

npx prisma generate

git add prisma/schema.prisma prisma/migrations package.json package-lock.json

git commit -m "db: $MIGRATION_NAME"

git push

echo "DB migration pushlandı."
read -p "Kapatmak için Enter..."