// Test without RAG system to verify memory issue
async function testNoRagFlow() {
  console.log('🧪 Testing chat flow without RAG system...\n');
  
  const requestBody = {
    message: "What are sets?",
    history: [],
    topicId: ""  // No topic ID = no RAG loading
  };
  
  try {
    console.log('📤 Sending request without RAG to /api/chat...');
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    console.log('📥 Receiving streaming response from Gemma 4...\n');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.trim());
      
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          if (json.response) {
            process.stdout.write(json.response);
            fullResponse += json.response;
          }
        } catch (e) {
          // Ignore partial JSON chunks
        }
      }
    }
    
    console.log('\n\n✅ Test finished without RAG!');
    console.log(`📊 Total response length: ${fullResponse.length} characters`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testNoRagFlow();
