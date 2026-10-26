#!/bin/bash
set -e

# ============================================================
#  OAuth Labs (PHP) — Deploy to Apache server
#
#  Usage:
#    bash setup.sh <GOOGLE_CLIENT_ID> <GOOGLE_CLIENT_SECRET>
#
#  Run this ON THE SERVER (ssh in first), or pipe via ssh:
#    ssh root@YOUR_IP 'bash -s' < setup.sh CLIENT_ID CLIENT_SECRET
# ============================================================

GOOGLE_CLIENT_ID="${1:?Usage: bash setup.sh <GOOGLE_CLIENT_ID> <GOOGLE_CLIENT_SECRET>}"
GOOGLE_CLIENT_SECRET="${2:?Pass GOOGLE_CLIENT_SECRET as second argument}"
DOMAIN="oauth-labs.h4ackerman.website"
EMAIL="ob3cru0n@gmail.com"
REPO="https://github.com/ob3cru0n-wq/bug-bounty-test.git"
BRANCH="claude/friendly-franklin-pwh4zh"

echo "============================================"
echo "  OAuth Labs (PHP) — Setting up"
echo "============================================"

echo "[1/5] Installing PHP + Apache modules..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq php libapache2-mod-php git certbot python3-certbot-apache >/dev/null 2>&1
a2enmod php* >/dev/null 2>&1 || true
echo "     PHP: $(php -v | head -1)"

echo "[2/5] Cloning repo..."
rm -rf /tmp/oauth-clone
git clone --branch "$BRANCH" --single-branch "$REPO" /tmp/oauth-clone 2>/dev/null

echo "[3/5] Deploying files to /var/www/oauth-labs..."
rm -rf /var/www/oauth-labs
cp -r /tmp/oauth-clone/oauth-labs-php /var/www/oauth-labs
rm -rf /tmp/oauth-clone

# Write credentials into config
sed -i "s|define('GOOGLE_CLIENT_ID'.*|define('GOOGLE_CLIENT_ID', '$GOOGLE_CLIENT_ID');|" /var/www/oauth-labs/config.php
sed -i "s|define('GOOGLE_CLIENT_SECRET'.*|define('GOOGLE_CLIENT_SECRET', '$GOOGLE_CLIENT_SECRET');|" /var/www/oauth-labs/config.php

chown -R www-data:www-data /var/www/oauth-labs

echo "[4/5] Configuring Apache..."
cp /var/www/oauth-labs/oauth-labs.conf /etc/apache2/sites-available/oauth-labs.conf
a2dissite 000-default.conf >/dev/null 2>&1 || true
a2ensite oauth-labs.conf >/dev/null 2>&1
apachectl configtest && systemctl reload apache2

echo "[5/5] Setting up SSL..."
certbot --apache -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" 2>/dev/null || echo "     SSL failed — check DNS"

echo ""
echo "============================================"
echo "  DONE!"
echo ""
echo "  https://$DOMAIN/                    (index)"
echo "  https://$DOMAIN/lab-07-implicit/    (Implicit)"
echo "  https://$DOMAIN/lab-08-gis-onetap/  (One Tap)"
echo "  https://$DOMAIN/lab-09-gis-button/  (Button)"
echo "  https://$DOMAIN/lab-10-gis-token-client/ (Token)"
echo "  https://$DOMAIN/lab-11-gis-code-client/  (Code)"
echo "============================================"
