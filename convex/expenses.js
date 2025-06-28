import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Helper function to update balances after expense creation
async function updateBalancesFromExpense(ctx, expenseId, splits, payerId) {
  for (const split of splits) {
    if (split.userId === payerId) {
      // Payer gets credit for what others owe them
      const creditAmount = splits
        .filter(s => s.userId !== payerId && !s.paid)
        .reduce((sum, s) => sum + s.amount, 0);
      
      if (creditAmount > 0) {
        await updateUserBalance(ctx, split.userId, creditAmount);
      }
    } else if (!split.paid) {
      // Other members owe their share
      await updateUserBalance(ctx, split.userId, -split.amount);
    }
  }
}

// Helper function to update individual user balance
async function updateUserBalance(ctx, userId, amountChange) {
  const existingBalance = await ctx.db
    .query("balances")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();

  if (existingBalance) {
    await ctx.db.patch(existingBalance._id, {
      amount: existingBalance.amount + amountChange,
      lastUpdated: Date.now(),
    });
  } else {
    await ctx.db.insert("balances", {
      userId,
      amount: amountChange,
      lastUpdated: Date.now(),
    });
  }
}

// Helper function to create expense document
async function createExpenseDocument(ctx, args) {
  // Use centralized getCurrentUser function
  const user = await ctx.runQuery(internal.users.getCurrentUser);

  // If there's a group, verify the user is a member
  if (args.groupId) {
    const group = await ctx.db.get(args.groupId);
    if (!group) {
      throw new Error("Group not found");
    }

    const isMember = group.members.some(
      (member) => member.userId === user._id
    );
    if (!isMember) {
      throw new Error("You are not a member of this group");
    }
  }

  // Verify that splits add up to the total amount
  const totalSplitAmount = args.splits.reduce(
    (sum, split) => sum + split.amount,
    0
  );
  const tolerance = 0.01; // Allow for small rounding errors
  if (Math.abs(totalSplitAmount - args.amount) > tolerance) {
    throw new Error("Split amounts must add up to the total expense amount");
  }

  // Create the expense
  const expenseId = await ctx.db.insert("expenses", {
    description: args.description,
    amount: args.amount,
    category: args.category || "Other",
    date: args.date,
    paidByUserId: args.paidByUserId,
    splitType: args.splitType,
    splits: args.splits,
    groupId: args.groupId,
    createdBy: user._id,
  });

  return expenseId;
}

// Create a new expense
export const createExpense = mutation({
  args: {
    description: v.string(),
    amount: v.number(),
    category: v.optional(v.string()),
    date: v.number(), // timestamp
    paidByUserId: v.id("users"),
    splitType: v.string(), // "equal", "percentage", "exact"
    splits: v.array(
      v.object({
        userId: v.id("users"),
        amount: v.number(),
        paid: v.boolean(),
      })
    ),
    groupId: v.optional(v.id("groups")),
  },
  handler: async (ctx, args) => {
    const expenseId = await createExpenseDocument(ctx, args);
    
    // Update balances after creating expense
    await updateBalancesFromExpense(ctx, expenseId, args.splits, args.paidByUserId);
    
    return expenseId;
  },
});

// Create expense from AI command with enhanced user lookup
export const createExpenseFromAI = mutation({
  args: {
    amount: v.number(),
    reason: v.string(),
    members: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    
    // Get all users for better matching
    const allUsers = await ctx.db.query("users").collect();
    console.log("All users in database:", allUsers.map(u => ({ id: u._id, name: u.name, email: u.email })));
    
    // Look up each member by name with flexible matching
    const memberUsers = [];
    const notFoundUsers = [];
    
    for (const memberName of args.members) {
      const cleanMemberName = memberName.trim().toLowerCase();
      console.log("Looking for member:", memberName, "-> cleaned:", cleanMemberName);
      
      // Try multiple search strategies
      let foundUser = null;
      
      // Strategy 1: Exact case-insensitive match
      foundUser = allUsers.find(u => 
        u.name && u.name.toLowerCase().trim() === cleanMemberName
      );
      
      // Strategy 2: Partial name match (first name or last name)
      if (!foundUser) {
        foundUser = allUsers.find(u => {
          if (!u.name) return false;
          const userName = u.name.toLowerCase().trim();
          const memberWords = cleanMemberName.split(/\s+/);
          const userWords = userName.split(/\s+/);
          
          // Check if any word in member name matches any word in user name
          return memberWords.some(memberWord => 
            userWords.some(userWord => 
              userWord.includes(memberWord) || memberWord.includes(userWord)
            )
          );
        });
      }
      
      // Strategy 3: Email match
      if (!foundUser) {
        foundUser = allUsers.find(u => 
          u.email && u.email.toLowerCase().trim() === cleanMemberName
        );
      }
      
      // Strategy 4: Contains match (less strict)
      if (!foundUser) {
        foundUser = allUsers.find(u => 
          u.name && u.name.toLowerCase().includes(cleanMemberName)
        );
      }
      
      if (foundUser) {
        console.log("Found user:", foundUser.name, "for search:", memberName);
        memberUsers.push(foundUser);
      } else {
        console.log("User not found for:", memberName);
        notFoundUsers.push(memberName);
      }
    }

    // If some users weren't found, provide helpful error message
    if (notFoundUsers.length > 0) {
      const availableUsers = allUsers.map(u => u.name).filter(Boolean).join(", ");
      throw new Error(`Users not found: ${notFoundUsers.join(', ')}. Available users: ${availableUsers}. Try using exact names or email addresses.`);
    }

    // Calculate per-person amount
    const totalPeople = memberUsers.length + 1; // including current user
    const perPerson = Math.round((args.amount / totalPeople) * 100) / 100;

    // Build splits array
    const splits = [
      // Current user (paid the expense)
      {
        userId: user._id,
        amount: perPerson,
        paid: true,
      },
      // Each member owes their share
      ...memberUsers.map((memberUser) => ({
        userId: memberUser._id,
        amount: perPerson,
        paid: false,
      })),
    ];

    // Create the expense document
    const expenseId = await createExpenseDocument(ctx, {
      description: args.reason,
      amount: args.amount,
      category: "Other",
      date: Date.now(),
      paidByUserId: user._id,
      splitType: "equal",
      splits,
      groupId: undefined, // AI expenses are always personal
    });

    // Update balances after creating AI expense
    await updateBalancesFromExpense(ctx, expenseId, splits, user._id);

    return expenseId;
  },
});

// Get all expenses for current user
export const getUserExpenses = query({
  handler: async (ctx) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    
    const expenses = await ctx.db
      .query("expenses")
      .filter((q) => 
        q.or(
          q.eq(q.field("paidByUserId"), user._id),
          q.eq(q.field("createdBy"), user._id)
        )
      )
      .order("desc")
      .collect();

    return expenses;
  },
});

// Get expenses between current user and a specific person
export const getExpensesBetweenUsers = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await ctx.runQuery(internal.users.getCurrentUser);
    if (me._id === userId) throw new Error("Cannot query yourself");

    /* ───── 1. One-on-one expenses where either user is the payer ───── */
    const myPaid = await ctx.db
      .query("expenses")
      .withIndex("by_user_and_group", (q) =>
        q.eq("paidByUserId", me._id).eq("groupId", undefined)
      )
      .collect();

    const theirPaid = await ctx.db
      .query("expenses")
      .withIndex("by_user_and_group", (q) =>
        q.eq("paidByUserId", userId).eq("groupId", undefined)
      )
      .collect();

    const candidateExpenses = [...myPaid, ...theirPaid];

    /* ───── 2. Keep only rows where BOTH are involved ─ */
    const expenses = candidateExpenses.filter((e) => {
      const meInSplits = e.splits.some((s) => s.userId === me._id);
      const themInSplits = e.splits.some((s) => s.userId === userId);

      const meInvolved = e.paidByUserId === me._id || meInSplits;
      const themInvolved = e.paidByUserId === userId || themInSplits;

      return meInvolved && themInvolved;
    });

    expenses.sort((a, b) => b.date - a.date);

    /* ───── 3. Settlements between the two of us ─ */
    const settlements = await ctx.db
      .query("settlements")
      .filter((q) =>
        q.and(
          q.eq(q.field("groupId"), undefined),
          q.or(
            q.and(
              q.eq(q.field("paidByUserId"), me._id),
              q.eq(q.field("receivedByUserId"), userId)
            ),
            q.and(
              q.eq(q.field("paidByUserId"), userId),
              q.eq(q.field("receivedByUserId"), me._id)
            )
          )
        )
      )
      .collect();

    settlements.sort((a, b) => b.date - a.date);

    /* ───── 4. Compute running balance ──────────────────────────────── */
    let balance = 0;

    for (const e of expenses) {
      if (e.paidByUserId === me._id) {
        const split = e.splits.find((s) => s.userId === userId && !s.paid);
        if (split) balance += split.amount;
      } else {
        const split = e.splits.find((s) => s.userId === me._id && !s.paid);
        if (split) balance -= split.amount;
      }
    }

    for (const s of settlements) {
      if (s.paidByUserId === me._id)
        balance += s.amount;
      else balance -= s.amount;
    }

    /* ───── 5. Return payload ───────────────────────────────────────── */
    const other = await ctx.db.get(userId);
    if (!other) throw new Error("User not found");

    return {
      expenses,
      settlements,
      otherUser: {
        id: other._id,
        name: other.name,
        email: other.email,
        imageUrl: other.imageUrl,
      },
      balance,
    };
  },
});

// Delete an expense
export const deleteExpense = mutation({
  args: {
    expenseId: v.id("expenses"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) {
      throw new Error("Expense not found");
    }

    if (expense.createdBy !== user._id && expense.paidByUserId !== user._id) {
      throw new Error("You don't have permission to delete this expense");
    }

    // Reverse balance updates before deleting
    await reverseBalanceUpdates(ctx, expense.splits, expense.paidByUserId);

    // Delete related settlements
    const allSettlements = await ctx.db.query("settlements").collect();
    const relatedSettlements = allSettlements.filter(
      (settlement) =>
        settlement.relatedExpenseIds?.includes(args.expenseId)
    );

    for (const settlement of relatedSettlements) {
      const updatedRelatedExpenseIds = settlement.relatedExpenseIds.filter(
        (id) => id !== args.expenseId
      );

      if (updatedRelatedExpenseIds.length === 0) {
        await ctx.db.delete(settlement._id);
      } else {
        await ctx.db.patch(settlement._id, {
          relatedExpenseIds: updatedRelatedExpenseIds,
        });
      }
    }

    // Delete the expense
    await ctx.db.delete(args.expenseId);

    return { success: true };
  },
});

// Helper function to reverse balance updates when deleting expense
async function reverseBalanceUpdates(ctx, splits, payerId) {
  for (const split of splits) {
    if (split.userId === payerId) {
      // Reverse credit
      const creditAmount = splits
        .filter(s => s.userId !== payerId && !s.paid)
        .reduce((sum, s) => sum + s.amount, 0);
      
      if (creditAmount > 0) {
        await updateUserBalance(ctx, split.userId, -creditAmount);
      }
    } else if (!split.paid) {
      // Reverse debt
      await updateUserBalance(ctx, split.userId, split.amount);
    }
  }
}

// Add a utility function to list all users (for debugging)
export const listAllUsers = query({
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map(u => ({
      id: u._id,
      name: u.name,
      email: u.email
    }));
  },
});

// Create demo users for testing
export const createDemoUsers = mutation({
  handler: async (ctx) => {
    const demoUsers = [
      { name: "Alice", email: "alice@demo.com" },
      { name: "Bob", email: "bob@demo.com" },
      { name: "Charlie", email: "charlie@demo.com" },
      { name: "Diana", email: "diana@demo.com" },
      { name: "John", email: "john@demo.com" },
      { name: "Sarah", email: "sarah@demo.com" },
      { name: "Mike", email: "mike@demo.com" },
    ];

    const createdUsers = [];
    
    for (const demoUser of demoUsers) {
      const existing = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("email"), demoUser.email))
        .first();
      
      if (!existing) {
        const userId = await ctx.db.insert("users", {
          name: demoUser.name,
          email: demoUser.email,
          tokenIdentifier: `demo_${demoUser.name.toLowerCase()}_${Date.now()}`,
          imageUrl: undefined,
        });
        createdUsers.push({ id: userId, ...demoUser });
      } else {
        createdUsers.push({ id: existing._id, name: existing.name, email: existing.email });
      }
    }

    return {
      message: "Demo users created/verified successfully",
      users: createdUsers
    };
  },
});
