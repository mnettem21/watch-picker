export type Service = {
  label: string;
  providerIds: number[];
};

export const SERVICES: Service[] = [
  { label: "Netflix", providerIds: [8] },
  { label: "Prime Video", providerIds: [9] },
  { label: "Hulu", providerIds: [15] },
  { label: "Disney+", providerIds: [337] },
  { label: "Apple TV+", providerIds: [350] },
  { label: "Peacock", providerIds: [386] },
  { label: "Paramount+", providerIds: [531] },
  { label: "Max", providerIds: [1899, 384] },
];

export function providerIdsFor(ids: number[]): string {
  return ids.join("|");
}

export function toggleService(selected: number[], providerIds: number[]): number[] {
  const next = new Set(selected);
  const checked = providerIds.every((id) => next.has(id));
  for (const id of providerIds) {
    if (checked) next.delete(id);
    else next.add(id);
  }
  return SERVICES.flatMap((service) => service.providerIds).filter((id) => next.has(id));
}

export function matchedServices(flatrateIds: number[], checkedIds: number[]): { label: string }[] {
  const available = new Set(flatrateIds);
  const checked = new Set(checkedIds);
  return SERVICES.filter((service) =>
    service.providerIds.some((id) => available.has(id) && checked.has(id)),
  ).map((service) => ({ label: service.label }));
}
