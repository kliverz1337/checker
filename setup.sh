#!/bin/bash

# Update sistem dan upgrade paket
sudo apt update
sudo apt -y upgrade

# Install Node.js versi terbaru dari NodeSource
curl -fsSL https://deb.nodesource.com/setup_current.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Node.js packages n untuk mengelola versi Node.js
sudo npm install -g n
sudo n latest

# Install Express Status Monitor
npm install express-status-monitor --save

# Download dan install Google Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb

# Perbaiki dependensi yang hilang (jika ada)
sudo apt --fix-broken install -y

# Install Puppeteer dan plugin tambahan untuk stealth mode
npm i puppeteer
npm install puppeteer-extra puppeteer-extra-plugin-stealth

# Install Express.js
npm install express

# Install PM2 untuk manajemen proses Node.js
sudo npm install -g pm2

# Setup PM2 agar berjalan otomatis setelah reboot
pm2 startup
pm2 save
