/**
 * Rewards Catalog & Gamification Points Engine
 * Features:
 * - Points calculation for Tasks (+20), Focus Blocks (+30), On-Time Departure (+50), End-of-Day Review (+100), Habit Routine (+15)
 * - Tiers: Micro (Candy, Chocolate, Donut, Coffee), Weekly (Pizza, Movie, Gaming), Grand (iPhone, Headphones, Trip)
 * - Streak calculation and claim history
 */
import { RewardItem, UserGamification, ClaimedRewardHistory } from '../types';

export const DEFAULT_REWARDS: RewardItem[] = [
  // Tier 1: Micro / Daily Treats
  {
    id: 'reward-candy',
    title: 'Favorite Candy Pack',
    icon: 'candy',
    category: 'Sweet Treat',
    pointsCost: 50,
    tier: 'MICRO',
    description: 'A small sweet treat or pack of gummies to celebrate a focused work session.',
    timesClaimed: 0,
  },
  {
    id: 'reward-chocolate',
    title: 'Artisan Dark Chocolate',
    icon: 'chocolate',
    category: 'Sweet Treat',
    pointsCost: 80,
    tier: 'MICRO',
    description: 'A premium single-origin chocolate bar or rich truffle after completing high-focus tasks.',
    timesClaimed: 0,
  },
  {
    id: 'reward-donut',
    title: 'Fresh Bakery Donut',
    icon: 'donut',
    category: 'Sweet Treat',
    pointsCost: 100,
    tier: 'MICRO',
    description: 'A delicious glazed, Boston cream, or cinnamon donut from your favorite cafe.',
    timesClaimed: 0,
  },
  {
    id: 'reward-coffee',
    title: 'Specialty Espresso / Latte',
    icon: 'coffee',
    category: 'Beverage',
    pointsCost: 70,
    tier: 'MICRO',
    description: 'An iced oat latte or hand-poured single-origin filter brew.',
    timesClaimed: 0,
  },

  // Tier 2: Weekly Milestones
  {
    id: 'reward-pizza',
    title: 'Cheat Meal Pizza Night',
    icon: 'pizza',
    category: 'Feast',
    pointsCost: 350,
    tier: 'WEEKLY',
    description: 'A wood-fired pizza with extra toppings for hitting your weekly deep work targets.',
    timesClaimed: 0,
  },
  {
    id: 'reward-movie',
    title: 'Movie Cinema Night',
    icon: 'movie',
    category: 'Entertainment',
    pointsCost: 400,
    tier: 'WEEKLY',
    description: 'Tickets to a new theater release with popcorn and prime recliner seating.',
    timesClaimed: 0,
  },
  {
    id: 'reward-gaming',
    title: '2-Hour Guilt-Free Gaming',
    icon: 'gaming',
    category: 'Relaxation',
    pointsCost: 300,
    tier: 'WEEKLY',
    description: 'Uninterrupted 2-hour gaming session with zero task anxiety or notifications.',
    timesClaimed: 0,
  },
  {
    id: 'reward-sushi',
    title: 'Specialty Sushi Platter',
    icon: 'sushi',
    category: 'Feast',
    pointsCost: 500,
    tier: 'WEEKLY',
    description: 'Premium sushi rolls and sashimi dinner to celebrate disciplined days.',
    timesClaimed: 0,
  },

  // Tier 3: Grand Milestones & Major Goals
  {
    id: 'reward-iphone',
    title: 'New iPhone / Flagship Upgrade',
    icon: 'iphone',
    category: 'Major Tech',
    pointsCost: 5000,
    tier: 'GRAND',
    description: 'The ultimate flagship phone reward for consistent 30-day accountability mastery.',
    timesClaimed: 0,
  },
  {
    id: 'reward-headphones',
    title: 'ANC Noise-Canceling Headphones',
    icon: 'headphones',
    category: 'Audio Gear',
    pointsCost: 2500,
    tier: 'GRAND',
    description: 'Top-tier Sony / Bose / AirPods Max for deep work and immersive flow.',
    timesClaimed: 0,
  },
  {
    id: 'reward-shoes',
    title: 'Premium Running / Gym Shoes',
    icon: 'shoes',
    category: 'Fitness Gear',
    pointsCost: 1800,
    tier: 'GRAND',
    description: 'Top-of-the-line performance trainers to power your morning routine.',
    timesClaimed: 0,
  },
  {
    id: 'reward-trip',
    title: 'Weekend Nature Getaway',
    icon: 'trip',
    category: 'Travel',
    pointsCost: 6000,
    tier: 'GRAND',
    description: 'A weekend cabin or beach trip to completely decompress and celebrate massive goals.',
    timesClaimed: 0,
  },
];

export const INITIAL_GAMIFICATION_STATE: UserGamification = {
  points: 120, // Initial starter points so user can test micro-rewards right away!
  currentStreakDays: 1,
  longestStreakDays: 1,
  totalFocusMinutes: 25,
  totalTasksCompleted: 3,
  totalReviewsCompleted: 0,
  lastActiveDate: new Date().toISOString().split('T')[0],
  claimedRewards: [],
  customRewards: [],
};

/**
 * Calculates updated streak when user is active today
 */
export function updateStreak(gamification: UserGamification): UserGamification {
  const todayStr = new Date().toISOString().split('T')[0];
  if (gamification.lastActiveDate === todayStr) {
    return gamification;
  }

  const lastDate = new Date(gamification.lastActiveDate);
  const today = new Date(todayStr);
  const diffDays = Math.round((today.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

  let newStreak = gamification.currentStreakDays;
  if (diffDays === 1) {
    // Consecutive day
    newStreak += 1;
  } else if (diffDays > 1) {
    // Missed a day
    newStreak = 1;
  }

  const newLongest = Math.max(gamification.longestStreakDays, newStreak);

  return {
    ...gamification,
    currentStreakDays: newStreak,
    longestStreakDays: newLongest,
    lastActiveDate: todayStr,
  };
}
