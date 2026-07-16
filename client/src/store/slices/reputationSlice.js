import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { apiClient } from "@/services/apiClient";

const CORE_CATEGORIES = [
  "Politics",
  "Technology",
  "Economy",
  "Environment",
  "World Affairs",
  "Science",
  "Health",
  "Culture",
  "Sports",
];

// Centralized ranking progression algorithm
export function getCategoryRankInfo(exp) {
  if (exp <= 0) {
    return {
      rank: "Unranked",
      medal: null,
      currentExp: 0,
      nextThreshold: 1,
      prevThreshold: 0,
      tierProgress: 0,
      tierRequired: 1,
      percentage: 0,
      level: 0,
    };
  }

  const levels = [
    { level: 1, min: 1, max: 50, rank: "Newcomer", medal: null },
    { level: 2, min: 50, max: 100, rank: "Contributor", medal: "bronze1" },
    { level: 3, min: 100, max: 200, rank: "Active Contributor", medal: "bronze2" },
    { level: 4, min: 200, max: 300, rank: "Senior Contributor", medal: "bronze3" },
    { level: 5, min: 300, max: 450, rank: "Analyst", medal: "silver1" },
    { level: 6, min: 450, max: 600, rank: "Senior Analyst", medal: "silver2" },
    { level: 7, min: 600, max: 750, rank: "Specialist", medal: "silver3" },
    { level: 8, min: 750, max: 900, rank: "Expert", medal: "gold1" },
    { level: 9, min: 900, max: 1050, rank: "Senior Expert", medal: "gold2" },
    { level: 10, min: 1050, max: 1200, rank: "Authority", medal: "gold3" },
    { level: 11, min: 1200, max: 1350, rank: "Distinguished Authority", medal: "platinum1" },
    { level: 12, min: 1350, max: 1500, rank: "Thought Leader", medal: "platinum2" },
    { level: 13, min: 1500, max: 2000, rank: "Community Icon", medal: "diamond" },
    { level: 14, min: 2000, max: Infinity, rank: "Visionary", medal: "diamondPlus" },
  ];

  const currentTier = levels.find(l => exp >= l.min && exp < l.max) || levels[levels.length - 1];

  const isMax = currentTier.max === Infinity;
  const min = currentTier.min;
  const max = isMax ? null : currentTier.max;
  const tierProgress = exp - min;
  const tierRequired = isMax ? null : (max - min);
  const percentage = isMax ? 100 : Math.min(100, Math.max(0, Math.round((tierProgress / tierRequired) * 100)));

  return {
    rank: currentTier.rank,
    medal: currentTier.medal,
    currentExp: exp,
    nextThreshold: max,
    prevThreshold: min,
    tierProgress,
    tierRequired,
    percentage,
    level: currentTier.level,
  };
}

// Global EXP config rules
const EXP_RULES = {
  message: 15,
  room: 50,
  reaction: 15,
};

// Async thunk to load reputation data from backend (source of persisted truth)
export const fetchReputationData = createAsyncThunk(
  "reputation/fetchData",
  async (userId, { rejectWithValue }) => {
    try {
      if (!userId) throw new Error("User ID required");
      const res = await apiClient.get(`/users/${userId}/category-contributions`);
      return { userId, data: res.data.data };
    } catch (err) {
      return rejectWithValue(err.response?.data?.error || err.message);
    }
  }
);

function recalculateCategories(categories) {
  // Sort categories by EXP descending
  const sorted = [...categories].sort((a, b) => b.currentExp - a.currentExp);
  const topThree = sorted.slice(0, 3);
  const remainingCategories = sorted.slice(3);
  const totalExp = sorted.reduce((sum, item) => sum + item.currentExp, 0);

  // Overall User level calculated from total EXP (Level = 1 + floor(sqrt(totalExp / 100)))
  const overallLevel = Math.floor(Math.sqrt(totalExp / 100)) + 1;

  const totalMessages = sorted.reduce((sum, item) => sum + item.messageCount, 0);
  const totalRoomsCreated = sorted.reduce((sum, item) => sum + item.roomsCreatedCount, 0);

  return {
    categories: sorted,
    topThree,
    remainingCategories,
    totalExp,
    totalReputation: totalExp,
    overallLevel,
    statistics: {
      totalMessages,
      totalRoomsCreated,
    },
  };
}

const reputationSlice = createSlice({
  name: "reputation",
  initialState: {
    userId: null,
    totalExp: 0,
    totalReputation: 0,
    categories: [],
    topThree: [],
    remainingCategories: [],
    overallLevel: 1,
    statistics: {
      totalMessages: 0,
      totalRoomsCreated: 0,
    },
    isLoading: false,
    error: null,
    optimisticLog: [],
  },
  reducers: {
    addOptimisticContribution: (state, action) => {
      const { category, type } = action.payload; // type = 'message' | 'room' | 'reaction'
      if (!category) return;

      const expChange = EXP_RULES[type] || 0;
      if (expChange === 0) return;

      // Track for possible rollback
      state.optimisticLog.push({ category, type, expChange });

      // Find category and update
      let catItem = state.categories.find(
        (c) => c.category.toLowerCase() === category.toLowerCase()
      );

      if (!catItem) {
        catItem = {
          category,
          messageCount: 0,
          roomsCreatedCount: 0,
          currentExp: 0,
        };
        state.categories.push(catItem);
      }

      if (type === "message") {
        catItem.messageCount += 1;
      } else if (type === "room") {
        catItem.roomsCreatedCount += 1;
      }

      catItem.currentExp += expChange;

      // Centralized rank calculation
      const rankInfo = getCategoryRankInfo(catItem.currentExp);
      Object.assign(catItem, rankInfo);

      // Recalculate ranking and lists
      const recalculated = recalculateCategories(state.categories);
      state.categories = recalculated.categories;
      state.topThree = recalculated.topThree;
      state.remainingCategories = recalculated.remainingCategories;
      state.totalExp = recalculated.totalExp;
      state.totalReputation = recalculated.totalReputation;
      state.overallLevel = recalculated.overallLevel;
      state.statistics = recalculated.statistics;
    },
    rollbackOptimisticContribution: (state) => {
      const lastAction = state.optimisticLog.pop();
      if (!lastAction) return;

      const { category, type, expChange } = lastAction;
      const catItem = state.categories.find(
        (c) => c.category.toLowerCase() === category.toLowerCase()
      );

      if (catItem) {
        catItem.currentExp -= expChange;
        if (type === "message") {
          catItem.messageCount = Math.max(0, catItem.messageCount - 1);
        } else if (type === "room") {
          catItem.roomsCreatedCount = Math.max(0, catItem.roomsCreatedCount - 1);
        }

        const rankInfo = getCategoryRankInfo(catItem.currentExp);
        Object.assign(catItem, rankInfo);
      }

      const recalculated = recalculateCategories(state.categories);
      state.categories = recalculated.categories;
      state.topThree = recalculated.topThree;
      state.remainingCategories = recalculated.remainingCategories;
      state.totalExp = recalculated.totalExp;
      state.totalReputation = recalculated.totalReputation;
      state.overallLevel = recalculated.overallLevel;
      state.statistics = recalculated.statistics;
    },
    clearOptimisticLog: (state) => {
      state.optimisticLog = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchReputationData.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchReputationData.fulfilled, (state, action) => {
        state.isLoading = false;
        state.userId = action.payload.userId;

        const data = action.payload.data || [];
        const categoryMap = new Map(data.map((item) => [item.category.toLowerCase(), item]));
        
        const merged = CORE_CATEGORIES.map((catName) => {
          const existing = categoryMap.get(catName.toLowerCase());
          if (existing) {
            return {
              ...existing,
              ...getCategoryRankInfo(existing.currentExp),
            };
          }
          return {
            category: catName,
            messageCount: 0,
            roomsCreatedCount: 0,
            ...getCategoryRankInfo(0),
          };
        });

        const recalculated = recalculateCategories(merged);
        state.categories = recalculated.categories;
        state.topThree = recalculated.topThree;
        state.remainingCategories = recalculated.remainingCategories;
        state.totalExp = recalculated.totalExp;
        state.totalReputation = recalculated.totalReputation;
        state.overallLevel = recalculated.overallLevel;
        state.statistics = recalculated.statistics;
        state.optimisticLog = [];
      })
      .addCase(fetchReputationData.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const {
  addOptimisticContribution,
  rollbackOptimisticContribution,
  clearOptimisticLog,
} = reputationSlice.actions;

export default reputationSlice.reducer;
