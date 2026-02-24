export const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700]

export function calculateTaskXp(priorityValue) {
  const priority = Number(priorityValue || 0)
  const bonus = Math.max(0, Math.min(5, priority)) * 5
  return 10 + bonus
}

export function getLevelFromXp(xpValue) {
  const xp = Number(xpValue || 0)
  let level = 1

  LEVEL_THRESHOLDS.forEach((threshold, index) => {
    if (xp >= threshold) {
      level = index + 1
    }
  })

  return level
}

export function getLevelStartXp(levelValue) {
  const level = Math.max(1, Number(levelValue || 1))
  return LEVEL_THRESHOLDS[level - 1] ?? LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1]
}

export function getNextLevelXp(levelValue) {
  const level = Math.max(1, Number(levelValue || 1))
  return LEVEL_THRESHOLDS[level] ?? null
}
