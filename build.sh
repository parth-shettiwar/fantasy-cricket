#!/usr/bin/env bash
set -o errexit

# Build frontend
cd frontend
npm install
npm run build
cd ..

# Install backend dependencies
cd backend
pip install -r requirements.txt
