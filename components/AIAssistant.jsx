'use client';
import { useState, useRef, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';

export default function AIAssistant() {
  const { user, isLoaded } = useUser();
  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [balances, setBalances] = useState([]);
  const [showBalances, setShowBalances] = useState(false);
  const recognitionRef = useRef(null);

  // Convex mutations and queries
  const createExpenseFromAI = useMutation(api.expenses.createExpenseFromAI);
  const balancesData = useQuery(api.balances.getAll);

  useEffect(() => {
    // Check if speech recognition is supported
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'en-US';
      }
    }
  }, []);

  useEffect(() => {
    if (balancesData) {
      setBalances(balancesData);
    }
  }, [balancesData]);

  const startListening = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition not supported in your browser');
      return;
    }

    setError('');
    setListening(true);
    
    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setListening(false);
    };
    
    recognitionRef.current.onerror = (event) => {
      setError('Speech recognition error: ' + event.error);
      setListening(false);
    };
    
    recognitionRef.current.onend = () => {
      setListening(false);
    };

    try {
      recognitionRef.current.start();
    } catch (err) {
      setError('Could not start speech recognition');
      setListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && listening) {
      recognitionRef.current.stop();
      setListening(false);
    }
  };

  const parseCommand = async (command) => {
    // Simple regex-based parsing as fallback
    const amountMatch = command.match(/(?:₹|rs\.?|rupees?)\s*(\d+(?:\.\d{2})?)/i) || 
                       command.match(/(\d+(?:\.\d{2})?)\s*(?:₹|rs\.?|rupees?)/i);
    
    if (!amountMatch) {
      throw new Error('Could not find amount in the command. Please specify amount like "₹500" or "500 rupees"');
    }

    const amount = parseFloat(amountMatch[1]);
    
    // Extract reason (words between amount and "split")
    let reason = command.toLowerCase()
      .replace(/₹?\s*\d+(?:\.\d{2})?\s*(?:₹|rs\.?|rupees?)?/gi, '')
      .replace(/\b(?:add|split|for|with|between|among|and|me|myself|i)\b/gi, '')
      .trim();
    
    if (!reason) {
      reason = 'Shared expense';
    }

    // Extract member names
    const splitIndex = command.toLowerCase().search(/\b(?:split|with|between|among)\b/);
    let memberText = '';
    if (splitIndex !== -1) {
      memberText = command.slice(splitIndex).toLowerCase()
        .replace(/\b(?:split|with|between|among|and|me|myself|i)\b/gi, '')
        .trim();
    }

    const members = memberText
      .split(/[,&+]/)
      .map(name => name.trim())
      .filter(name => name.length > 0 && !['me', 'myself', 'i'].includes(name.toLowerCase()));

    if (members.length === 0) {
      throw new Error('Please specify at least one person to split with');
    }

    return { amount, reason, members };
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!isLoaded) {
      setError('Please wait while we load your account');
      return;
    }

    if (!user) {
      setError('Please sign in to add expenses');
      return;
    }

    if (!input.trim()) {
      setError('Please enter a command');
      return;
    }

    setLoading(true);
    setError('');
    setResponse('');

    try {
      // First try to use the API route with OpenAI
      const apiRes = await fetch('/api/process-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command: input.trim() }),
      });

      let parsedData;
      
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        if (apiData.success) {
          setResponse(apiData.message);
          setInput('');
          setShowBalances(true);
          return;
        } else {
          console.warn('API route failed, falling back to local parsing');
          // Fall back to local parsing
          parsedData = await parseCommand(input.trim());
        }
      } else {
        console.warn('API route unavailable, using local parsing');
        // Fall back to local parsing
        parsedData = await parseCommand(input.trim());
      }

      // Use Convex directly if API route fails
      if (parsedData) {
        const expenseId = await createExpenseFromAI({
          amount: parsedData.amount,
          reason: parsedData.reason,
          members: parsedData.members,
        });

        const totalMembers = parsedData.members.length + 1;
        const splitAmount = Math.round((parsedData.amount / totalMembers) * 100) / 100;

        setResponse(
          `✅ Added ₹${parsedData.amount} for ${parsedData.reason} split among ${totalMembers} people (₹${splitAmount} each)`
        );
        setInput('');
        setShowBalances(true);
      }

    } catch (error) {
      console.error('Submit error:', error);
      
      if (error.message?.includes('User not found')) {
        setError('One or more people mentioned were not found. Please check the names and try again.');
      } else if (error.message?.includes('amount')) {
        setError('Please specify a valid amount. Example: "Add ₹500 for dinner"');
      } else if (error.message?.includes('person')) {
        setError('Please mention at least one person to split with. Example: "split with John"');
      } else {
        setError(error.message || 'Failed to process command. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatBalance = (balance) => {
    if (balance.amount > 0) {
      return `You are owed ₹${balance.amount.toFixed(2)}`;
    } else if (balance.amount < 0) {
      return `You owe ₹${Math.abs(balance.amount).toFixed(2)}`;
    } else {
      return 'Settled';
    }
  };

  const exampleCommands = [
    "Add ₹1200 for groceries split between Alice, Bob and me",
    "Split ₹500 for dinner with John and Sarah", 
    "Add ₹300 for coffee shared with Mike",
    "₹800 for movie tickets split among Tom, Jerry and me",
    "Add 200 rupees for snacks with Lisa"
  ];

  if (!isLoaded) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg border border-gray-200">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-12 bg-gray-200 rounded mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg border border-gray-200">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            🤖 AI Expense Assistant
          </h3>
          <p className="text-gray-600 mb-4">
            Please sign in to use the AI expense assistant
          </p>
          <button 
            onClick={() => window.location.href = '/sign-in'}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg border border-gray-200">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">
          🤖 AI Expense Assistant
        </h3>
        <p className="text-sm text-gray-600">
          Speak or type commands like "Add ₹500 for dinner split with John and Alice"
        </p>
        {user && (
          <p className="text-xs text-gray-500 mt-1">
            Signed in as {user.firstName} {user.lastName}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Speak or type your expense command..."
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            disabled={loading || listening}
          />
          
          <button
            type="button"
            onClick={listening ? stopListening : startListening}
            disabled={loading}
            className={`px-4 py-3 rounded-lg font-medium transition-colors ${
              listening
                ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {listening ? '🛑 Stop' : '🎤 Speak'}
          </button>
          
          <button
            type="submit"
            disabled={loading || listening || !input.trim()}
            className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processing...' : 'Process'}
          </button>
        </div>
      </form>

      {/* Response Display */}
      {response && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-green-500 text-lg">✅</span>
            <p className="text-green-800 font-medium">{response}</p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <span className="text-red-500 text-lg">❌</span>
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Balances Display */}
      {showBalances && balances.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
            💰 Your Balances
            <button 
              onClick={() => setShowBalances(false)}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              Hide
            </button>
          </h4>
          <div className="space-y-1">
            {balances.slice(0, 5).map((balance, index) => (
              <div key={index} className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${
                  balance.amount > 0 ? 'bg-green-500' : balance.amount < 0 ? 'bg-red-500' : 'bg-gray-500'
                }`}></div>
                <span className="text-blue-700">{formatBalance(balance)}</span>
              </div>
            ))}
            {balances.length > 5 && (
              <p className="text-xs text-blue-600">And {balances.length - 5} more...</p>
            )}
          </div>
        </div>
      )}

      {/* Examples */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-800 mb-2">Example Commands:</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          {exampleCommands.map((cmd, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <button
                onClick={() => setInput(cmd)}
                className="text-left hover:text-blue-600 transition-colors"
              >
                "{cmd}"
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Tips */}
      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h5 className="font-medium text-yellow-800 mb-1 text-sm">💡 Tips:</h5>
        <ul className="text-xs text-yellow-700 space-y-1">
          <li>• Use "₹" or "rupees" to specify amounts</li>
          <li>• Mention people by their names</li>
          <li>• Voice input works best in Chrome/Edge</li>
          <li>• Add descriptions like "for dinner" or "for groceries"</li>
        </ul>
      </div>
    </div>
  );
}
