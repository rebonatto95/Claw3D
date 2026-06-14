// @vitest-environment node

import { describe, expect, it } from "vitest";

describe("createAccessGate", () => {
  it("allows when token is unset", async () => {
    const { createAccessGate } = await import("../../server/access-gate");
    const gate = createAccessGate({ token: "" });
    expect(gate.allowUpgrade({ headers: {} })).toBe(true);
  });

  it("does not gate /api requests even when token is configured", async () => {
    const { createAccessGate } = await import("../../server/access-gate");
    const gate = createAccessGate({ token: "abc" });

    let statusCode = 0;
    let ended = false;
    const res = {
      setHeader: () => {},
      end: () => {
        ended = true;
      },
      get statusCode() {
        return statusCode;
      },
      set statusCode(value: number) {
        statusCode = value;
      },
    };

    const handled = gate.handleHttp(
      { url: "/api/studio", headers: { host: "example.test" } },
      res
    );

    expect(handled).toBe(false);
    expect(statusCode).toBe(0);
    expect(ended).toBe(false);
  });

  it("allows upgrades when token is configured", async () => {
    const { createAccessGate } = await import("../../server/access-gate");
    const gate = createAccessGate({ token: "abc" });
    expect(
      gate.allowUpgrade({ headers: {} })
    ).toBe(true);
  });

  it("never throttles by studio_access token anymore", async () => {
    const { createAccessGate } = await import("../../server/access-gate");
    const gate = createAccessGate({ token: "abc" });

    const createResponse = () => {
      let statusCode = 0;
      let body = "";
      return {
        setHeader: () => {},
        end: (value?: string) => {
          body = value ?? "";
        },
        get statusCode() {
          return statusCode;
        },
        set statusCode(value: number) {
          statusCode = value;
        },
        get body() {
          return body;
        },
      };
    };

    for (let index = 0; index < 9; index++) {
      const res = createResponse();
      gate.handleHttp(
        { url: "/api/studio", headers: {}, socket: { remoteAddress: "127.0.0.1" } },
        res
      );
      expect(res.statusCode).toBe(0);
    }

    const limited = createResponse();
    gate.handleHttp(
      { url: "/api/studio", headers: {}, socket: { remoteAddress: "127.0.0.1" } },
      limited
    );

    expect(limited.statusCode).toBe(0);
    expect(limited.body).toBe("");
  });

  it("keeps allowing requests regardless of cookie when token is configured", async () => {
    const { createAccessGate } = await import("../../server/access-gate");
    const gate = createAccessGate({ token: "abc" });

    const createResponse = () => {
      let statusCode = 0;
      let body = "";
      return {
        setHeader: () => {},
        end: (value?: string) => {
          body = value ?? "";
        },
        get statusCode() {
          return statusCode;
        },
        set statusCode(value: number) {
          statusCode = value;
        },
        get body() {
          return body;
        },
      };
    };

    for (let index = 0; index < 10; index++) {
      const res = createResponse();
      gate.handleHttp(
        { url: "/api/studio", headers: {}, socket: { remoteAddress: "127.0.0.1" } },
        res
      );
    }

    expect(
      gate.allowUpgrade({ headers: {}, socket: { remoteAddress: "127.0.0.1" } })
    ).toBe(true);

    const recovered = createResponse();
    gate.handleHttp(
      {
        url: "/api/studio",
        headers: {},
        socket: { remoteAddress: "127.0.0.1" },
      },
      recovered
    );

    expect(recovered.statusCode).toBe(0);

    const afterReset = createResponse();
    gate.handleHttp(
      { url: "/api/studio", headers: {}, socket: { remoteAddress: "127.0.0.1" } },
      afterReset
    );

    expect(afterReset.statusCode).toBe(0);
    expect(afterReset.body).toBe("");
  });
});
