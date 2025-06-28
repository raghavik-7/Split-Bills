import { useState, useRef } from 'react';
import AssistantChat from './assistant-chat';

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const recognitionRef = useRef(null);

  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error("Speech recognition not supported");
      return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;

    recognitionRef.current.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      // Send transcript to processing
    };

    recognitionRef.current.start();
    setVoiceActive(true);
  };

  const stopVoiceInput = () => {
    recognitionRef.current?.stop();
    setVoiceActive(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen ? (
        <AssistantChat 
          onClose={() => setIsOpen(false)}
          onVoiceToggle={voiceActive ? stopVoiceInput : startVoiceInput}
          voiceActive={voiceActive}
        />
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white p-4 rounded-full shadow-lg"
        >
          AI Assistant
        </button>
      )}
    </div>
  );
}
