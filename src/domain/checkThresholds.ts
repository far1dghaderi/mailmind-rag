export type Limits = Record<string, { min?: number; max?: number }>;

// Returns one message per metric that is outside its limit; empty means no regression.
export function checkThresholds(metrics: Record<string, number>, limits: Limits): string[] {
  const failures: string[] = [];
  for (const [name, { min, max }] of Object.entries(limits)) {
    const value = metrics[name];
    if (value === undefined) failures.push(`${name} is missing from the results`);
    else if (min !== undefined && value < min) failures.push(`${name} is ${value}, below the floor of ${min}`);
    else if (max !== undefined && value > max) failures.push(`${name} is ${value}, above the ceiling of ${max}`);
  }
  return failures;
}
