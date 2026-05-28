// Test Ollama directly
async function testOllama() {
  console.log('🧪 Testing Ollama directly...\n');
  
  try {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemma3n:latest',
        prompt: 'Hello, how are you?',
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Ollama Response:', data.response);
    
  } catch (error) {
    console.error('❌ Ollama test failed:', error.message);
  }
}

testOllama();
