const KEY = 'star-tavern-save-v1';

export function createStorage() {
  let memory = null;
  return {
    load() {
      try {
        const raw = window.localStorage.getItem(KEY);
        if (raw !== null) return raw;
      } catch {}
      return memory;
    },
    save(obj) {
      let json;
      try {
        json = JSON.stringify(obj);
      } catch {
        return;
      }
      memory = json;
      try {
        window.localStorage.setItem(KEY, json);
      } catch {}
    },
    clear() {
      memory = null;
      try {
        window.localStorage.removeItem(KEY);
      } catch {}
    },
  };
}