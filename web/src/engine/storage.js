const KEY = 'star-tavern-save-v1';
const WAREHOUSE_KEY = 'star-tavern-warehouse-v1';

export function createStorage() {
  let memory = null;
  let warehouseMemory = null;
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
    loadWarehouse() {
      try {
        const raw = window.localStorage.getItem(WAREHOUSE_KEY);
        if (raw !== null) return JSON.parse(raw);
      } catch {}
      return warehouseMemory;
    },
    saveWarehouse(obj) {
      warehouseMemory = obj;
      try {
        window.localStorage.setItem(WAREHOUSE_KEY, JSON.stringify(obj));
      } catch {}
    },
  };
}