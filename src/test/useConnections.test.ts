import { describe, expect, it } from "vitest";
import { getOverallConnectionStatus } from "@/hooks/useConnections";

describe("getOverallConnectionStatus", () => {
  it("retorna connected quando existe ao menos uma conexão conectada", () => {
    const status = getOverallConnectionStatus([
      { status: "disconnected" as const },
      { status: "connected" as const },
    ]);

    expect(status).toBe("connected");
  });

  it("retorna pending quando não há connected e existe pending", () => {
    const status = getOverallConnectionStatus([
      { status: "error" as const },
      { status: "pending" as const },
    ]);

    expect(status).toBe("pending");
  });

  it("retorna disconnected quando a lista está vazia", () => {
    expect(getOverallConnectionStatus([])).toBe("disconnected");
  });
});
