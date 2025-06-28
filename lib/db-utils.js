// lib/db-utils.js
import { api } from "@/convex/_generated/api";

// For client-side usage (in React components)
let convexClient = null;

// Function to set the convex client (call this in your app initialization)
export function setConvexClient(client) {
  convexClient = client;
}

// Server-side functions for API routes
export async function saveExpense(data) {
  try {
    // Use the createExpenseFromAI mutation from your expenses.js
    const { ConvexHttpClient } = await import("convex/browser");
    const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
    
    const expenseId = await client.mutation(api.expenses.createExpenseFromAI, {
      amount: data.amount,
      reason: data.reason,
      members: data.members,
    });

    console.log('Expense saved successfully:', expenseId);
    return expenseId;
  } catch (error) {
    console.error('Error saving expense:', error);
    throw new Error(`Failed to save expense: ${error.message}`);
  }
}

// Get all balances
export async function getBalances() {
  try {
    const { ConvexHttpClient } = await import("convex/browser");
    const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
    
    const balances = await client.query(api.balances.getAll);
    return balances || [];
  } catch (error) {
    console.error('Error getting balances:', error);
    return [];
  }
}

// Get user balances for a specific user
export async function getUserBalance(userId) {
  try {
    const { ConvexHttpClient } = await import("convex/browser");
    const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
    
    const balance = await client.query(api.balances.getUserBalance, { userId });
    return balance;
  } catch (error) {
    console.error('Error getting user balance:', error);
    return null;
  }
}

// Client-side functions (for React components)
export async function saveExpenseClient(data) {
  if (!convexClient) {
    throw new Error('Convex client not initialized. Call setConvexClient first.');
  }
  
  try {
    const expenseId = await convexClient.mutation(api.expenses.createExpenseFromAI, {
      amount: data.amount,
      reason: data.reason,
      members: data.members,
    });

    return expenseId;
  } catch (error) {
    console.error('Error saving expense (client):', error);
    throw new Error(`Failed to save expense: ${error.message}`);
  }
}

// Get expenses for current user (client-side)
export async function getUserExpenses() {
  if (!convexClient) {
    throw new Error('Convex client not initialized. Call setConvexClient first.');
  }
  
  try {
    const expenses = await convexClient.query(api.expenses.getUserExpenses);
    return expenses || [];
  } catch (error) {
    console.error('Error getting user expenses:', error);
    return [];
  }
}

// Get expenses between two users
export async function getExpensesBetweenUsers(userId) {
  if (!convexClient) {
    throw new Error('Convex client not initialized. Call setConvexClient first.');
  }
  
  try {
    const expenses = await convexClient.query(api.expenses.getExpensesBetweenUsers, { userId });
    return expenses;
  } catch (error) {
    console.error('Error getting expenses between users:', error);
    return { expenses: [], settlements: [], balance: 0 };
  }
}

// Delete an expense
export async function deleteExpense(expenseId) {
  if (!convexClient) {
    throw new Error('Convex client not initialized. Call setConvexClient first.');
  }
  
  try {
    await convexClient.mutation(api.expenses.deleteExpense, { expenseId });
    return true;
  } catch (error) {
    console.error('Error deleting expense:', error);
    throw new Error(`Failed to delete expense: ${error.message}`);
  }
}

// Calculate balance summary for current user
export async function getBalanceSummary() {
  if (!convexClient) {
    throw new Error('Convex client not initialized. Call setConvexClient first.');
  }
  
  try {
    const balances = await convexClient.query(api.balances.getAll);
    
    if (!balances || balances.length === 0) {
      return {
        totalOwed: 0,
        totalOwing: 0,
        netBalance: 0,
        transactions: []
      };
    }

    let totalOwed = 0;
    let totalOwing = 0;
    
    balances.forEach(balance => {
      if (balance.amount > 0) {
        totalOwed += balance.amount;
      } else {
        totalOwing += Math.abs(balance.amount);
      }
    });

    return {
      totalOwed,
      totalOwing,
      netBalance: totalOwed - totalOwing,
      transactions: balances
    };
  } catch (error) {
    console.error('Error getting balance summary:', error);
    return {
      totalOwed: 0,
      totalOwing: 0,
      netBalance: 0,
      transactions: []
    };
  }
}

// Utility function to format currency
export function formatCurrency(amount, currency = '₹') {
  return `${currency}${Math.abs(amount).toFixed(2)}`;
}

// Utility function to format balance description
export function formatBalanceDescription(balance) {
  if (balance.amount > 0) {
    return `You are owed ${formatCurrency(balance.amount)}`;
  } else if (balance.amount < 0) {
    return `You owe ${formatCurrency(balance.amount)}`;
  } else {
    return 'Settled';
  }
}

// Search users by name (for AI assistant)
export async function searchUsersByName(names) {
  if (!convexClient) {
    throw new Error('Convex client not initialized. Call setConvexClient first.');
  }
  
  try {
    const users = await Promise.all(
      names.map(async (name) => {
        const user = await convexClient.query(api.users.searchByName, { name });
        return user;
      })
    );
    
    return users.filter(user => user !== null);
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
}

// Validate expense data
export function validateExpenseData(data) {
  const errors = [];
  
  if (!data.amount || typeof data.amount !== 'number' || data.amount <= 0) {
    errors.push('Amount must be a positive number');
  }
  
  if (!data.reason || typeof data.reason !== 'string' || data.reason.trim().length === 0) {
    errors.push('Reason is required');
  }
  
  if (!Array.isArray(data.members) || data.members.length === 0) {
    errors.push('At least one member is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// Export all functions for easier importing
export default {
  saveExpense,
  getBalances,
  getUserBalance,
  saveExpenseClient,
  getUserExpenses,
  getExpensesBetweenUsers,
  deleteExpense,
  getBalanceSummary,
  formatCurrency,
  formatBalanceDescription,
  searchUsersByName,
  validateExpenseData,
  setConvexClient
};
