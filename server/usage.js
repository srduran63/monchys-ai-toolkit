// Monthly usage counters per customer (transcription minutes, images processed…).
import { createStore } from './store.js';

const store = await createStore('usage', {});
const monthKey = () => new Date().toISOString().slice(0, 7);

export function usedThisMonth(userId, metric) {
  return store.data[userId]?.[monthKey()]?.[metric] ?? 0;
}

export async function addUsage(userId, metric, amount) {
  const month = (store.data[userId] ??= {})[monthKey()] ??= {};
  month[metric] = (month[metric] ?? 0) + amount;
  await store.save();
}
