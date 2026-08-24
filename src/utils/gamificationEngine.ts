export interface GamificationStats {
  xp: number;
  level: number;
  levelTitle: string;
  streakDays: number;
  xpToNextLevel: number;
  progressPercent: number;
}

export const calculateGamificationStats = (xp: number, streakDays: number = 1): GamificationStats => {
  const levelThresholds = [
    { level: 1, title: 'Novice Planner', minXp: 0 },
    { level: 2, title: 'Focus Initiate', minXp: 200 },
    { level: 3, title: 'Time Weaver', minXp: 500 },
    { level: 4, title: 'Accountability Master', minXp: 1000 },
    { level: 5, title: 'Cyber Productivity Specialist', minXp: 2000 },
    { level: 6, title: 'Grandmaster Architect', minXp: 3500 },
  ];

  let currentLevel = levelThresholds[0];
  let nextLevel = levelThresholds[1];

  for (let i = 0; i < levelThresholds.length; i++) {
    if (xp >= levelThresholds[i].minXp) {
      currentLevel = levelThresholds[i];
      nextLevel = levelThresholds[i + 1] || { level: currentLevel.level + 1, title: 'Legendary Architect', minXp: currentLevel.minXp + 2000 };
    }
  }

  const range = nextLevel.minXp - currentLevel.minXp;
  const currentProgress = xp - currentLevel.minXp;
  const progressPercent = Math.min(100, Math.max(0, Math.round((currentProgress / range) * 100)));

  return {
    xp,
    level: currentLevel.level,
    levelTitle: currentLevel.title,
    streakDays,
    xpToNextLevel: nextLevel.minXp - xp,
    progressPercent
  };
};
