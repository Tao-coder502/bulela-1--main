# Bulela: Zambian Math Tutor for Grades 8 & 9

<div align="center">
  <h3>Offline-First AI-Powered Education for Zambia</h3>
  <p>Built for the Gemma 4 Good Hackathon</p>
</div>

**Bulela** (meaning *"to speak"* or *"to express"* in Silozi) is an offline-first Progressive Web App (PWA) that provides personalized mathematics tutoring for Zambian Junior Secondary students (Grades 8 and 9). Powered by a localized, hardware-optimized AI model and rich cultural context, Bulela helps students master the Zambian Curriculum Framework (ZCF) and Competency-Based Curriculum (CBC) entirely offline—completely eliminating the barrier of expensive internet data.

## 🇿🇲 Why Bulela?

- **Offline-First**: Works without internet, perfect for areas with limited connectivity
- **Cultural Context**: "Ba Yama" persona speaks in Chi-Zamblish (Bemba/Nyanja/English mix)
- **Curriculum-Aligned**: Strictly follows Zambian Grade 8-9 CBC Math syllabus
- **Multimodal**: Voice input and camera support for handwritten problems
- **Gamified**: Points, streaks, and mastery levels to keep students engaged
- **Teacher Dashboard**: Classroom insights for educators

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **Ollama** with Gemma 4 model installed
- **Windows, macOS, or Linux**

### Step 1: Install Ollama and Gemma 4

Bulela uses Ollama for local AI processing:

```bash
# Install Ollama (if not already installed)
# Visit: https://ollama.com/download

# Pull the Gemma 4 model
ollama pull gemma4:e4b

# Verify installation
ollama list
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment

Create a `.env` file in the project root (see `.env.example` for reference):

```env
OLLAMA_HOST=localhost
OLLAMA_PORT=11434
OLLAMA_MODEL=gemma4:latest
DEMO_MODE=false
```

**Environment Variables:**
- `OLLAMA_HOST`: Host where Ollama is running (default: auto-detected local IP)
- `OLLAMA_PORT`: Ollama API port (default: 11434)
- `OLLAMA_MODEL`: Model to use (default: gemma4:latest)
- `DEMO_MODE`: Enable demo mode for presentations (default: false)

### Step 4: Run the Application

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## 📱 Features

### Core Learning
- **Interactive Chat**: Ask math questions and get step-by-step explanations
- **Topic-Based Learning**: Browse curriculum-aligned math topics
- **Dictionary Search**: Look up math terms with localized definitions
- **Progress Tracking**: Monitor mastery levels and scores

### Multimodal Input
- **Voice Input**: Speak your math problems (Chrome, Edge, Safari)
- **Camera Upload**: Snap photos of handwritten work for analysis
- **Text Input**: Type questions directly

### Offline Capabilities
- **PWA Support**: Install as a mobile app for offline access
- **Local Database**: SQLite stores progress locally
- **Cached Content**: Topics and dictionary available offline

### Gamification
- **Points System**: Earn points for completing lessons
- **Streak Tracking**: Maintain daily learning streaks
- **Mastery Levels**: Progress from Basic to Advanced
- **Achievement Badges**: Unlock rewards for milestones

## 🏫 For Teachers

Access the Teacher Dashboard to:
- View classroom statistics
- Identify problematic topics
- Track student engagement
- Export progress reports

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Backend**: Fastify, Node.js
- **Database**: SQLite (better-sqlite3)
- **AI**: Ollama with Gemma 4 model
- **PWA**: Vite Plugin PWA
- **Security**: Helmet, rate limiting, DOMPurify

## 📚 Curriculum Coverage

Aligned with Zambian Grade 8 & 9 CBC Math topics:
- Algebra and Equations
- Geometry and Measurement
- Statistics and Probability
- Number Operations
- Financial Mathematics

## 🌐 Browser Support

- **Best Experience**: Chrome, Edge, Safari
- **Voice Input**: Chrome, Edge, Safari (Web Speech API)
- **PWA**: All modern browsers with service worker support

## 📦 Build for Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

## 🚀 Deployment Guide

### Option 1: Classroom Hub Model (Recommended for Schools)

**The "Knowledge Lighthouse" Architecture** - One powerful laptop serves an entire classroom:

1. **Prepare the Teacher's Laptop**
   ```bash
   # Install Node.js (v18+)
   # Install Ollama: https://ollama.com/download
   
   # Pull Gemma 4 model
   ollama pull gemma4:latest
   ```

2. **Configure Ollama for Network Access (Windows)**
   - Search for "Environment Variables" in Windows
   - Add New System Variable:
     - **Variable:** `OLLAMA_HOST`
     - **Value:** `0.0.0.0` (Listens to all network devices)
   - Restart Ollama

3. **Configure Bulela Environment**
   ```bash
   # Create .env file
   OLLAMA_HOST=127.0.0.1  # Connect to Ollama on same machine
   OLLAMA_PORT=11434
   OLLAMA_MODEL=gemma4:latest
   DEMO_MODE=false
   ```

4. **Build and Run**
   ```bash
   npm install
   npm run build
   npm start
   ```

5. **Connect Student Devices**
   - Enable Mobile Hotspot on teacher's laptop
   - Students connect to the Wi-Fi
   - Students open browser: `http://<laptop-ip>:3000`
   - **Zero data costs** - all processing happens locally

**Why This Wins:**
- Hardware inclusion: 2018 budget phones get "High-IQ" AI
- Zero data costs: No internet bundles needed
- Privacy: Data never leaves the classroom
- Speed: Near-instant responses (5m signal vs USA server)

### Option 2: Docker Deployment

```dockerfile
# Dockerfile example
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t bulela .
docker run -p 3000:3000 --env-file .env bulela
```

### Option 3: Cloud Deployment with Ollama

For cloud deployment, you'll need a service that supports GPU or sufficient CPU:

**Recommended Platforms:**
- **Railway**: Easy deployment with GPU support
- **Render**: Good for CPU-based inference
- **DigitalOcean**: Flexible VPS options
- **AWS EC2**: Full control over resources

**Key Considerations:**
- Ollama requires significant RAM (4GB+ for Gemma 4)
- GPU acceleration recommended for faster responses
- Ensure Ollama is accessible from your app server
- Use environment variables for configuration

### Demo Mode for Presentations

For hackathon presentations or demos without Ollama:

```bash
# Enable demo mode
DEMO_MODE=true npm run dev
```

Demo mode provides:
- Pre-canned contextual responses
- No Ollama dependency
- Perfect for unreliable network conditions

## �🔧 Troubleshooting

### Ollama Connection Issues
- Ensure Ollama is running: `ollama serve`
- Check Gemma 4 model is installed: `ollama list`
- Verify Ollama URL in `.env` file

### Voice Input Not Working
- Use Chrome, Edge, or Safari (Firefox not supported)
- Allow microphone permissions in browser
- Check if microphone is connected

### Camera Upload Issues
- Allow camera permissions in browser
- Ensure image file is valid (JPG, PNG)
- Check browser console for errors

## 🤝 Contributing

This project was built for the Gemma 4 Good Hackathon. Contributions welcome!

## 📄 License

MIT License - Built for educational impact in Zambia

## 🙏 Acknowledgments

- Gemma 4 Good Hackathon organizers
- Zambian Ministry of Education (Curriculum reference)
- Ollama team for local AI infrastructure
- The Zambian education community
