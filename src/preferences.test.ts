import { createPreferenceStore } from "./preferences";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

function throwingStorage() {
  return {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
}

describe("preferences", () => {
  it("defaults country to US and services to empty", () => {
    expect(createPreferenceStore(memoryStorage()).get()).toEqual({ services: [], country: "US" });
  });

  it("keeps services across a new store on the same storage", () => {
    const storage = memoryStorage();
    createPreferenceStore(storage).set({ services: [8, 15], country: "US" });
    expect(createPreferenceStore(storage).get()).toEqual({ services: [8, 15], country: "US" });
  });

  it("turns an unreadable country into US and unreadable services into an empty selection", () => {
    const storage = memoryStorage();
    storage.setItem("watch-picker.country", "nope");
    storage.setItem("watch-picker.services", "{");
    expect(createPreferenceStore(storage).get()).toEqual({ services: [], country: "US" });
  });

  it("keeps choices in memory when storage throws", () => {
    const store = createPreferenceStore(throwingStorage());
    store.set({ services: [8], country: "US" });
    expect(store.get()).toEqual({ services: [8], country: "US" });
    expect(createPreferenceStore(throwingStorage()).get().services).toEqual([]);
  });
});
