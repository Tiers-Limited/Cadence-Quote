#!/bin/bash
cd /home/ubuntu/app
npm install --production
pm2 stop all || true
pm2 start server.js
