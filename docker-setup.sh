#!/bin/bash

# Docker setup script for Bulela
# This script helps initialize the Docker environment and pull the required Ollama model

echo "🚀 Setting up Bulela with Docker..."

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from .env.example..."
    cp .env.example .env
    echo "✅ .env file created. Please review and update it if needed."
else
    echo "✅ .env file already exists."
fi

# Build and start the containers
echo "🔨 Building Docker containers..."
docker-compose build

echo "🐳 Starting containers..."
docker-compose up -d

echo "⏳ Waiting for Ollama to be ready..."
sleep 10

# Pull the Gemma 4 model
echo "📥 Pulling Gemma 4 model (this may take a while)..."
docker-compose exec -T ollama ollama pull gemma4:latest

echo "✅ Setup complete!"
echo "🌐 Bulela is now running at http://localhost:3000"
echo "📊 Check logs with: docker-compose logs -f"
echo "🛑 Stop containers with: docker-compose down"
