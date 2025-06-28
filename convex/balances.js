// convex/balances.js
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const getAll = query({
  handler: async (ctx) => {
    try {
      const user = await ctx.runQuery(internal.users.getCurrentUser);
      if (!user) {
        return [];
      }
      
      const balances = await ctx.db.query("balances").collect();
      return balances || [];
    } catch (error) {
      console.error("Error getting balances:", error);
      return [];
    }
  },
});

export const getUserBalance = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    try {
      return await ctx.db
        .query("balances")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();
    } catch (error) {
      console.error("Error getting user balance:", error);
      return null;
    }
  },
});

export const getCurrentUserBalance = query({
  handler: async (ctx) => {
    try {
      const user = await ctx.runQuery(internal.users.getCurrentUser);
      if (!user) return null;
      
      return await ctx.db
        .query("balances")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .unique();
    } catch (error) {
      console.error("Error getting current user balance:", error);
      return null;
    }
  },
});

export const updateBalance = mutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
  },
  handler: async (ctx, { userId, amount }) => {
    try {
      const existingBalance = await ctx.db
        .query("balances")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .unique();

      if (existingBalance) {
        await ctx.db.patch(existingBalance._id, {
          amount: existingBalance.amount + amount,
          lastUpdated: Date.now(),
        });
      } else {
        await ctx.db.insert("balances", {
          userId,
          amount,
          lastUpdated: Date.now(),
        });
      }
    } catch (error) {
      console.error("Error updating balance:", error);
      throw new Error("Failed to update balance");
    }
  },
});
