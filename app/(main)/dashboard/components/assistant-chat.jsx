import { useState } from 'react';
import { useAction } from 'convex/react';

export default function AssistantChat({ onClose, onVoiceToggle, voiceActive }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const processCommand = useAction('ai:processCommand');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message to chat
    setMessages(prev => [...prev, { text: input, isUser: true }]);
    const userInput = input;
    setInput('');

    try {
      // Show processing indicator
      setMessages(prev => [...prev, { text: "Processing...", isUser: false }]);
      
      // Send to Convex action
      const result = await processCommand({ command: userInput });
      
      // Update with result
      setMessages(prev => [
        ...prev.slice(0, -1), 
        { text: result, isUser: false }
      ]);
    } catch (error) {
      setMessages(prev => [
        ...prev.slice(0, -1), 
        { text: "Error: " + error.message, isUser: false }
      ]);
    }
  };

  return (
    <div className="bg-white border rounded-lg shadow-xl w-96 h-[500px] flex flex-col">
      <div className="p-4 border-b flex justify-between items-center">
        <h3 className="font-bold">Bill Assistant</h3>
        <button onClick={onClose}>✕</button>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto">
        {messages.map((msg, i) => (
          <div key={i} className={`mb-3 ${msg.isUser ? 'text-right' : ''}`}>
            <div className={`inline-block px-4 py-2 rounded-lg ${
              msg.isUser ? 'bg-blue-100' : 'bg-gray-100'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>
      
      <form onSubmit={handleSubmit} className="p-4 border-t flex">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a command..."
          className="flex-1 border rounded-l-lg px-4 py-2 focus:outline-none"
        />
        <button
          type="button"
          onClick={onVoiceToggle}
          className={`px-4 py-2 ${
            voiceActive ? 'bg-red-500' : 'bg-gray-200'
          }`}
        >
          🎤
        </button>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded-r-lg"
        >
          Send
        </button>
      </form>
    </div>
  );
}
