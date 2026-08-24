// A small seeded PRNG (mulberry32).
//
// Math.random() is deliberately NOT used: a thesis has to be able to say
// "the dataset was generated with seed 42" and have anyone reproduce exactly
// the same events. Every random choice in the simulator draws from here.
const createRandom = (seed = 42) => {
  let state = seed >>> 0;

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (minInclusive, maxInclusive) =>
    minInclusive + Math.floor(next() * (maxInclusive - minInclusive + 1));

  const chance = (probability) => next() < probability;

  const pick = (items) => items[Math.floor(next() * items.length)];

  // Draw one item where `weights[i]` is the relative likelihood of `items[i]`.
  // Used for the long tail: a few products are popular with everyone.
  const pickWeighted = (items, weights) => {
    const total = weights.reduce((sum, w) => sum + w, 0);

    if (total <= 0) {
      return pick(items);
    }

    let roll = next() * total;

    for (let i = 0; i < items.length; i += 1) {
      roll -= weights[i];
      if (roll <= 0) {
        return items[i];
      }
    }

    return items[items.length - 1];
  };

  // Fisher-Yates, so shuffles are reproducible too.
  const shuffle = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(next() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  return { next, int, chance, pick, pickWeighted, shuffle };
};

module.exports = { createRandom };
