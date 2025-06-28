import { parseExpense } from '@/lib/ai-command-parser';
import { fetchMutation } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { auth } from "@clerk/nextjs/server";

export async function POST(request) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return Response.json(
        { error: 'Unauthorized. Please log in to add expenses.' },
        { status: 401 }
      );
    }

    // Parse request body
    const { command } = await request.json();
    
    if (!command || typeof command !== 'string') {
      return Response.json(
        { error: 'Invalid command provided' },
        { status: 400 }
      );
    }

    // Validate command length
    if (command.trim().length === 0) {
      return Response.json(
        { error: 'Command cannot be empty' },
        { status: 400 }
      );
    }

    if (command.length > 500) {
      return Response.json(
        { error: 'Command too long. Please keep it under 500 characters.' },
        { status: 400 }
      );
    }

    console.log('Processing command:', command);

    // Parse the natural language command using local Mistral
    const parsedData = await parseExpense(command);
    
    if (!parsedData || !parsedData.amount || !parsedData.reason) {
      return Response.json(
        { error: 'Could not parse the command. Please try rephrasing it.' },
        { status: 400 }
      );
    }

    // Validate parsed data
    if (parsedData.amount <= 0) {
      return Response.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    if (parsedData.amount > 1000000) {
      return Response.json(
        { error: 'Amount is too large. Please enter a reasonable amount.' },
        { status: 400 }
      );
    }

    if (!Array.isArray(parsedData.members)) {
      return Response.json(
        { error: 'Invalid members list format' },
        { status: 400 }
      );
    }

    // Calculate split details
    let totalMembers;
    if (parsedData.payer === 'me') {
      totalMembers = parsedData.members.length; // Only other members
    } else {
      totalMembers = parsedData.members.length + 1; // Members + current user
    }
    
    if (totalMembers === 0) {
      return Response.json(
        { error: 'At least one other person must be included in the expense' },
        { status: 400 }
      );
    }
    
    const splitAmount = Math.round((parsedData.amount / totalMembers) * 100) / 100;

    console.log('Parsed expense data:', {
      amount: parsedData.amount,
      reason: parsedData.reason,
      members: parsedData.members,
      payer: parsedData.payer,
      totalMembers,
      splitAmount
    });

    // Save to Convex database
    const expenseId = await fetchMutation(api.expenses.createExpenseFromAI, {
      amount: parsedData.amount,
      reason: parsedData.reason,
      members: parsedData.members,
      payer: parsedData.payer
    });

    console.log('Expense saved with ID:', expenseId);

    // Create response message with payer information
    const payerDisplay = parsedData.payer === "me" ? "You" : parsedData.payer;
    const message = `${payerDisplay} paid ₹${parsedData.amount} for ${parsedData.reason} split among ${totalMembers} people (₹${splitAmount} each)`;

    // Return success response
    return Response.json({
      success: true,
      message,
      data: {
        expenseId,
        amount: parsedData.amount,
        reason: parsedData.reason,
        members: parsedData.members,
        payer: parsedData.payer,
        totalMembers,
        splitAmount,
        amountPerPerson: splitAmount
      }
    });

  } catch (error) {
    console.error('API Error:', error);
    
    // Handle specific error types
    if (error.message?.includes('User not found')) {
      return Response.json(
        { error: 'One or more users mentioned were not found. Please check names and try again.' },
        { status: 400 }
      );
    }

    if (error.message?.includes('Payer not found')) {
      return Response.json(
        { 
          error: error.message + 
          (parsedData?.payer && parsedData.payer !== "me"
            ? ` Make sure to use the exact name of the person who paid.`
            : ` If you are the payer, try using "me" or your own name.`)
        },
        { status: 400 }
      );
    }

    if (error.message?.includes('Failed to parse') || 
        error.message?.includes('No JSON') ||
        error.message?.includes('Mistral')) {
      return Response.json(
        { error: 'Could not understand the command. Try: "John paid ₹500 for dinner with Alice and me"' },
        { status: 400 }
      );
    }

    if (error.message?.includes('Network')) {
      return Response.json(
        { error: 'Network error. Please check your Ollama server and connection.' },
        { status: 503 }
      );
    }

    // Generic error response
    return Response.json(
      { error: error.message || 'Failed to process command. Please try again.' },
      { status: 500 }
    );
  }
}

// Handle GET requests (for testing/health check)
export async function GET() {
  return Response.json(
    { 
      message: 'AI Expense Processing API',
      status: 'active',
      endpoints: {
        POST: 'Process natural language expense commands',
        examples: [
          'John paid ₹1200 for groceries split between Alice, Bob and me',
          'Add ₹500 for dinner with Sarah and me',
          'Alice spent ₹300 for coffee shared with Mike and me'
        ]
      }
    },
    { status: 200 }
  );
}

// Handle other HTTP methods
export async function PUT() {
  return Response.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function DELETE() {
  return Response.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}

export async function PATCH() {
  return Response.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
