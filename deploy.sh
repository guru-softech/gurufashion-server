#!/bin/bash
# =================================================================
# Guru Fashions Automated Deployment Script
# =================================================================

# Exit immediately if any command fails
set -e

echo "🚀 Starting Guru Fashions Deployment..."

# 1. Update Backend
echo "📥 Updating server codebase..."
cd /home/ubuntu/gurufashions-server
git pull origin main

echo "🔄 Restarting Express backend server via PM2..."
pm2 restart ecosystem.config.js || pm2 restart gurufashions-server

# 2. Update Frontend
echo "📥 Updating client codebase..."
cd /home/ubuntu/gurufashions-client
git pull origin main

echo "📦 Installing client dependencies..."
npm install

echo "🛠️ Building client production bundle..."
npm run build

echo "✅ Deployment completed successfully!"
