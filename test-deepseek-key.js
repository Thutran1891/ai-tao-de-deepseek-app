// Test API key từ terminal
const axios = require('axios');

const apiKey = 'sk-xxx-your-key'; // Thay bằng key của bạn

axios.post('https://api.deepseek.com/chat/completions', {
  model: 'deepseek-chat',
  messages: [{ role: 'user', content: 'Hello' }]
}, {
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  }
})
.then(res => console.log('Success:', res.data))
.catch(err => console.error('Error:', err.response?.data || err.message));