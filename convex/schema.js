import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    name: v.string(),
    email: v.string(),
    tokenIdentifier: v.string(),
    imageUrl: v.optional(v.string()),
  })
    .index("by_token", ["tokenIdentifier"])
    .index("by_email", ["email"])
    .searchIndex("search_name", { searchField: "name" })
    .searchIndex("search_email", { searchField: "email" }),

  // Expenses
  expenses: defineTable({
    description: v.string(),
    amount: v.number(),
    category: v.optional(v.string()),
    date: v.number(), // timestamp
    paidByUserId: v.id("users"), // Reference to users table
    splitType: v.string(), // "equal", "percentage", "exact"
    splits: v.array(
      v.object({
        userId: v.id("users"), // Reference to users table
        amount: v.number(), // amount owed by this user
        paid: v.boolean(),
      })
    ),
    groupId: v.optional(v.id("groups")), // null for one-on-one expenses
    createdBy: v.id("users"), // Reference to users table
  })
    .index("by_group", ["groupId"])
    .index("by_user_and_group", ["paidByUserId", "groupId"])
    .index("by_date", ["date"])
    .index("by_created_by", ["createdBy"]),

  // Settlements
  settlements: defineTable({
    amount: v.number(),
    note: v.optional(v.string()),
    date: v.number(), // timestamp
    paidByUserId: v.id("users"), // Reference to users table
    receivedByUserId: v.id("users"), // Reference to users table
    groupId: v.optional(v.id("groups")), // null for one-on-one settlements
    relatedExpenseIds: v.optional(v.array(v.id("expenses"))), // Which expenses this settlement covers
    createdBy: v.id("users"), // Reference to users table
  })
    .index("by_group", ["groupId"])
    .index("by_user_and_group", ["paidByUserId", "groupId"])
    .index("by_receiver_and_group", ["receivedByUserId", "groupId"])
    .index("by_date", ["date"]),

  // Groups
  groups: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    createdBy: v.id("users"), // Reference to users table
    members: v.array(
      v.object({
        userId: v.id("users"), // Reference to users table
        role: v.string(), // "admin" or "member"
        joinedAt: v.number(),
      })
    ),
  })
    .index("by_created_by", ["createdBy"]),

  // Balances - for tracking who owes whom (AI feature)
  balances: defineTable({
    userId: v.id("users"), // Reference to users table
    amount: v.number(), // Positive = owed money, Negative = owes money
    lastUpdated: v.number(), // timestamp of last update
  })
    .index("by_user", ["userId"]),

  // Transactions - for detailed balance tracking (optional)
  transactions: defineTable({
    fromUserId: v.id("users"), // Who owes money
    toUserId: v.id("users"), // Who is owed money
    amount: v.number(), // Amount owed
    expenseId: v.optional(v.id("expenses")), // Related expense if any
    settlementId: v.optional(v.id("settlements")), // Related settlement if any
    description: v.string(), // Description of the transaction
    date: v.number(), // timestamp
    status: v.string(), // "pending", "settled", "cancelled"
    groupId: v.optional(v.id("groups")), // null for one-on-one transactions
  })
    .index("by_from_user", ["fromUserId"])
    .index("by_to_user", ["toUserId"])
    .index("by_expense", ["expenseId"])
    .index("by_settlement", ["settlementId"])
    .index("by_group", ["groupId"])
    .index("by_date", ["date"])
    .index("by_status", ["status"]),

  // Categories - for expense categorization
  categories: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()), // hex color code
    icon: v.optional(v.string()), // icon name or emoji
    createdBy: v.id("users"),
    isDefault: v.boolean(), // system default categories
  })
    .index("by_created_by", ["createdBy"])
    .index("by_default", ["isDefault"]),

  // Notifications - for user notifications
  notifications: defineTable({
    userId: v.id("users"), // Who receives the notification
    type: v.string(), // "expense_added", "payment_received", etc.
    title: v.string(),
    message: v.string(),
    read: v.boolean(),
    relatedExpenseId: v.optional(v.id("expenses")),
    relatedSettlementId: v.optional(v.id("settlements")),
    relatedGroupId: v.optional(v.id("groups")),
    createdAt: v.number(), // timestamp
  })
    .index("by_user", ["userId"])
    .index("by_read", ["read"])
    .index("by_type", ["type"])
    .index("by_created_at", ["createdAt"])
    .index("by_user_and_read", ["userId", "read"]),
});
