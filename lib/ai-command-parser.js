export async function parseExpense(command) {
  try {
    const ollamaRes = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'mistral',
        prompt: `
You are an AI assistant that helps users add expenses by parsing natural language commands. Extract the amount, reason, payer, and list of people to split with from the user's command. Return a JSON object with this structure:
{
  "amount": number,
  "reason": string,
  "payer": string,
  "members": string[]
}
Rules:
1. Amount is required and must be > 0.
2. Reason is any short phrase describing the expense.
3. Payer is:
    - "me" if current user paid
    - a name if someone else paid
4. Members are names the bill is shared with (excluding payer).
5. If no members mentioned, use an empty array.
6. If payer is not clear, default to "me".
7. Detect when another person is the payer (e.g., “John paid ₹300...” → payer: "John").
8. Never include the payer in the members array.

Examples:
Command: "John paid ₹300 for dinner with Alice and me"
→ { "amount": 300, "reason": "dinner", "payer": "John", "members": ["Alice"] }

Command: "Add ₹500 for groceries split between Bob and me"
→ { "amount": 500, "reason": "groceries", "payer": "me", "members": ["Bob"] }

Command: "Alice spent ₹200 on coffee with me"
→ { "amount": 200, "reason": "coffee", "payer": "Alice", "members": [] }

Command: """${command}"""
Respond ONLY with the JSON object.
        `,
        stream: false
      })
    });

    if (!ollamaRes.ok) throw new Error('Failed to call local Mistral (Ollama)');

    const result = await ollamaRes.json();
    const content = result.response.trim();
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON found in Mistral response');

    const parsedData = JSON.parse(jsonMatch[0]);

    // Validations
    if (typeof parsedData.amount !== 'number' || parsedData.amount <= 0) {
      throw new Error('Invalid amount parsed from command');
    }
    if (typeof parsedData.reason !== 'string' || parsedData.reason.trim() === '') {
      throw new Error('Invalid reason parsed from command');
    }
    if (!Array.isArray(parsedData.members)) {
      throw new Error('Invalid members array parsed from command');
    }
    if (typeof parsedData.payer !== 'string' || !parsedData.payer.trim()) {
      parsedData.payer = 'me';
    }

    return parsedData;
  } catch (error) {
    console.error('Error parsing expense command:', error);
    throw new Error(`Failed to parse command: ${error.message}`);
  }
}
