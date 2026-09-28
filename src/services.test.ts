import { SERVICES, providerIdsFor } from "./services";

describe("services", () => {
  it("includes both Max provider ids", () => {
    expect(SERVICES.find((service) => service.label === "Max")?.providerIds).toEqual([1899, 384]);
    expect(providerIdsFor([8, 1899, 384])).toBe("8|1899|384");
  });
});
