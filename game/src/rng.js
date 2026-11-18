// A small seeded random stream (splitmix32): the same seed builds the same city,
// which is what makes the screenshot scenes repeatable frame for frame.
// String seeds hash to a stream of their own; numeric strings keep the stream
// of the number they spell, so ?seed=7 and seed 7 build the same city.
function hashSeed(seed) {
  if (typeof seed === 'number') return (seed >>> 0) || 0x9e3779b9;
  const text = String(seed);
  const asNumber = Number(text);
  if (text.trim() !== '' && Number.isInteger(asNumber)) return (asNumber >>> 0) || 0x9e3779b9;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) || 0x9e3779b9;
}

export function createRng(seed) {
  let state = hashSeed(seed);

  function next() {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x21f0aaad);
    z = Math.imul(z ^ (z >>> 15), 0x735a2d97);
    z ^= z >>> 15;
    return (z >>> 0) / 4294967296;
  }

  return {
    next,
    range(min, max) {
      return min + (max - min) * next();
    },
    int(min, max) {
      return Math.floor(min + (max - min + 1) * next());
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    chance(p) {
      return next() < p;
    },
  };
}
