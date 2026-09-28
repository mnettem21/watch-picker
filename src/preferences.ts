export type Preferences = {
  services: number[];
  country: string;
};

type KeyValueStore = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

const COUNTRY_KEY = "watch-picker.country";
const SERVICES_KEY = "watch-picker.services";

export function createPreferenceStore(storage: KeyValueStore) {
  let memory: Preferences | null = null;
  let persist = true;

  function readCountry(): string {
    const raw = storage.getItem(COUNTRY_KEY);
    if (raw && /^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
    return "US";
  }

  function readServices(): number[] {
    const raw = storage.getItem(SERVICES_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is number => Number.isInteger(item));
    } catch {
      return [];
    }
  }

  return {
    get(): Preferences {
      if (memory) return memory;
      try {
        memory = { country: readCountry(), services: readServices() };
      } catch {
        persist = false;
        memory = { services: [], country: "US" };
      }
      return memory;
    },
    set(next: Preferences) {
      memory = {
        services: [...next.services],
        country: next.country || "US",
      };
      if (!persist) return;
      try {
        storage.setItem(COUNTRY_KEY, memory.country);
        storage.setItem(SERVICES_KEY, JSON.stringify(memory.services));
      } catch {
        persist = false;
      }
    },
  };
}
