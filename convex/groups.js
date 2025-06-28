import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// Create a new group with validation
export const createGroup = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    memberIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    
    // Verify all members exist
    const memberPromises = args.memberIds.map(id => ctx.db.get(id));
    const members = await Promise.all(memberPromises);
    if (members.some(m => !m)) {
      throw new Error("One or more members not found");
    }

    // Include current user as admin if not already in members
    const allMembers = new Set(args.memberIds);
    allMembers.add(user._id);

    return await ctx.db.insert("groups", {
      name: args.name,
      description: args.description || "",
      createdBy: user._id,
      members: Array.from(allMembers).map(id => ({
        userId: id,
        role: id === user._id ? "admin" : "member"
      })),
    });
  },
});

// Update group details
export const updateGroup = mutation({
  args: {
    groupId: v.id("groups"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    addMembers: v.optional(v.array(v.id("users"))),
    removeMembers: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    const group = await ctx.db.get(args.groupId);
    
    if (!group) throw new Error("Group not found");
    if (!group.members.some(m => m.userId === user._id && m.role === "admin")) {
      throw new Error("Only group admins can modify the group");
    }

    // Update name/description
    const updates = {};
    if (args.name) updates.name = args.name;
    if (args.description) updates.description = args.description;

    // Handle member changes
    if (args.addMembers || args.removeMembers) {
      let members = [...group.members];
      
      // Add new members
      if (args.addMembers?.length) {
        const newMembers = args.addMembers.map(id => ({
          userId: id,
          role: "member"
        }));
        members = [...members, ...newMembers];
      }
      
      // Remove members
      if (args.removeMembers?.length) {
        members = members.filter(
          m => !args.removeMembers.includes(m.userId)
        );
      }
      
      updates.members = members;
    }

    return await ctx.db.patch(args.groupId, updates);
  },
});

// Delete a group
export const deleteGroup = mutation({
  args: { groupId: v.id("groups") },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    const group = await ctx.db.get(args.groupId);
    
    if (!group) throw new Error("Group not found");
    if (group.createdBy !== user._id) {
      throw new Error("Only group creator can delete the group");
    }
    
    // Delete related expenses and settlements
    const expenses = await ctx.db.query("expenses")
      .withIndex("by_group", q => q.eq("groupId", args.groupId))
      .collect();
      
    const settlements = await ctx.db.query("settlements")
      .filter(q => q.eq(q.field("groupId"), args.groupId))
      .collect();
      
    await Promise.all([
      ...expenses.map(e => ctx.db.delete(e._id)),
      ...settlements.map(s => ctx.db.delete(s._id))
    ]);
    
    return await ctx.db.delete(args.groupId);
  },
});

// Get group details with optional member expansion
export const getGroupOrMembers = query({
  args: {
    groupId: v.optional(v.id("groups")),
  },
  handler: async (ctx, args) => {
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);

    // Get all groups where user is a member
    const allGroups = await ctx.db.query("groups").collect();
    const userGroups = allGroups.filter(group =>
      group.members.some(member => member.userId === currentUser._id)
    );

    // Return specific group with details if requested
    if (args.groupId) {
      const selectedGroup = userGroups.find(
        group => group._id === args.groupId
      );

      if (!selectedGroup) {
        throw new Error("Group not found or you're not a member");
      }

      // Get member details with roles
      const memberDetails = await Promise.all(
        selectedGroup.members.map(async member => {
          const user = await ctx.db.get(member.userId);
          return user ? {
            id: user._id,
            name: user.name,
            email: user.email,
            imageUrl: user.imageUrl,
            role: member.role,
          } : null;
        })
      );

      return {
        selectedGroup: {
          id: selectedGroup._id,
          name: selectedGroup.name,
          description: selectedGroup.description,
          createdBy: selectedGroup.createdBy,
          members: memberDetails.filter(Boolean),
        },
        groups: userGroups.map(group => ({
          id: group._id,
          name: group.name,
          description: group.description,
          memberCount: group.members.length,
        })),
      };
    }
    
    // Return group list without details
    return {
      selectedGroup: null,
      groups: userGroups.map(group => ({
        id: group._id,
        name: group.name,
        description: group.description,
        memberCount: group.members.length,
      })),
    };
  },
});

// Get detailed financial data for a group
export const getGroupExpenses = query({
  args: { groupId: v.id("groups") },
  handler: async (ctx, { groupId }) => {
    const currentUser = await ctx.runQuery(internal.users.getCurrentUser);
    const group = await ctx.db.get(groupId);
    
    if (!group) throw new Error("Group not found");
    if (!group.members.some(m => m.userId === currentUser._id)) {
      throw new Error("You are not a member of this group");
    }

    // Get all financial data
    const [expenses, settlements] = await Promise.all([
      ctx.db.query("expenses")
        .withIndex("by_group", q => q.eq("groupId", groupId))
        .collect(),
      ctx.db.query("settlements")
        .filter(q => q.eq(q.field("groupId"), groupId))
        .collect()
    ]);

    // Prepare member data
    const memberDetails = await Promise.all(
      group.members.map(async m => {
        const u = await ctx.db.get(m.userId);
        return u ? {
          id: u._id,
          name: u.name,
          imageUrl: u.imageUrl,
          role: m.role,
        } : null;
      })
    );
    const validMembers = memberDetails.filter(Boolean);
    const memberIds = validMembers.map(m => m.id);

    // Initialize financial tracking
    const totals = Object.fromEntries(memberIds.map(id => [id, 0]));
    const ledger = {};
    memberIds.forEach(a => {
      ledger[a] = {};
      memberIds.forEach(b => {
        if (a !== b) ledger[a][b] = 0;
      });
    });

    // Process expenses
    expenses.forEach(exp => {
      const payer = exp.paidByUserId;
      exp.splits.forEach(split => {
        if (split.userId === payer || split.paid) return;
        
        totals[payer] += split.amount;
        totals[split.userId] -= split.amount;
        ledger[split.userId][payer] += split.amount;
      });
    });

    // Process settlements
    settlements.forEach(s => {
      totals[s.paidByUserId] += s.amount;
      totals[s.receivedByUserId] -= s.amount;
      ledger[s.paidByUserId][s.receivedByUserId] -= s.amount;
    });

    // Net the ledger
    memberIds.forEach(a => {
      memberIds.forEach(b => {
        if (a >= b) return;
        const diff = ledger[a][b] - ledger[b][a];
        if (diff > 0) {
          ledger[a][b] = diff;
          ledger[b][a] = 0;
        } else if (diff < 0) {
          ledger[b][a] = -diff;
          ledger[a][b] = 0;
        } else {
          ledger[a][b] = ledger[b][a] = 0;
        }
      });
    });

    // Prepare balance data
    const balances = validMembers.map(m => ({
      ...m,
      totalBalance: totals[m.id],
      owes: Object.entries(ledger[m.id])
        .filter(([, amount]) => amount > 0)
        .map(([to, amount]) => ({ to, amount })),
      owedBy: memberIds
        .filter(id => ledger[id][m.id] > 0)
        .map(from => ({ from, amount: ledger[from][m.id] })),
    }));

    // Create user lookup map
    const userLookupMap = validMembers.reduce((map, member) => {
      map[member.id] = member;
      return map;
    }, {});

    return {
      group: {
        id: group._id,
        name: group.name,
        description: group.description,
      },
      members: validMembers,
      expenses,
      settlements,
      balances,
      userLookupMap,
    };
  },
});

// Add member to group
export const addGroupMember = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    const [group, newMember] = await Promise.all([
      ctx.db.get(args.groupId),
      ctx.db.get(args.userId)
    ]);
    
    if (!group) throw new Error("Group not found");
    if (!newMember) throw new Error("User not found");
    if (!group.members.some(m => m.userId === user._id && m.role === "admin")) {
      throw new Error("Only admins can add members");
    }
    if (group.members.some(m => m.userId === args.userId)) {
      throw new Error("User is already a member");
    }

    return await ctx.db.patch(args.groupId, {
      members: [...group.members, { userId: args.userId, role: "member" }]
    });
  },
});

// Remove member from group
export const removeGroupMember = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.users.getCurrentUser);
    const group = await ctx.db.get(args.groupId);
    
    if (!group) throw new Error("Group not found");
    if (!group.members.some(m => m.userId === user._id && m.role === "admin")) {
      throw new Error("Only admins can remove members");
    }
    if (group.createdBy === args.userId) {
      throw new Error("Cannot remove group creator");
    }

    return await ctx.db.patch(args.groupId, {
      members: group.members.filter(m => m.userId !== args.userId)
    });
  },
});
