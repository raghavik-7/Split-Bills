import { action } from './_generated/server';

export const processCommand = action(async ({ runMutation }, { command, userId }) => {
  const ollamaRes = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'mistral',
      prompt: `
Parse this bill-splitting command: "${command}"
Return JSON with:
- intent: "split" | "createGroup"
- amount: number (if applicable)
- description: string
- participants: string[] (usernames, EXCLUDING payer)
- groupName: string (if applicable)
- payer: string (username)

Examples:
Command: "John paid ₹300 for dinner with Alice and me"
→ {
  "intent": "split",
  "amount": 300,
  "description": "dinner",
  "participants": ["Alice"],
  "payer": "John"
}

Command: "Create a group called Roommates with Bob and Alice"
→ {
  "intent": "createGroup",
  "groupName": "Roommates",
  "participants": ["Bob", "Alice"],
  "payer": null
}
`,
      stream: false
    })
  });

  if (!ollamaRes.ok) throw new Error('Failed to call local Mistral (Ollama)');
  const result = await ollamaRes.json();
  const content = result.response.trim();
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Mistral response');

  const parsed = JSON.parse(jsonMatch[0]);

  switch (parsed.intent) {
    case 'split':
      return runMutation('expenses:createFromAI', {
        amount: parsed.amount,
        description: parsed.description,
        participants: parsed.participants,
        payer: parsed.payer,
        userId
      });
    case 'createGroup':
      return runMutation('groups:createFromAI', {
        name: parsed.groupName,
        members: parsed.participants,
        userId
      });
    default:
      throw new Error("Unsupported command");
  }
});
