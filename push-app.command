#!/bin/bash
cd "$(dirname "$0")"

echo "Commit mesajını gir:"
read COMMIT_MESSAGE

echo ""
echo "GIT STATUS"
git status

echo ""
echo "ADD"
git add .

echo ""
echo "COMMIT"
git commit -m "$COMMIT_MESSAGE"

echo ""
echo "PUSH"
git push

echo ""
echo "İşlem tamamlandı."

read -p "Kapatmak için Enter..."