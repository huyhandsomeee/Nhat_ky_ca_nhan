const listeners = new Map();

function subscribe(userId, listener) {
  const key = String(userId);
  const group = listeners.get(key) || new Set();
  group.add(listener);
  listeners.set(key, group);
  return () => {
    group.delete(listener);
    if (!group.size) listeners.delete(key);
  };
}

function publish(userId, event, data) {
  for (const listener of listeners.get(String(userId)) || []) listener({ event, data });
}

module.exports = { subscribe, publish };
