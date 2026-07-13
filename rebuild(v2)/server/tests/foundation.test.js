import { describe, it, expect } from "vitest";
import { Logger } from "../src/shared/logger/Logger.js";
import { EventBus } from "../src/shared/event-bus/EventBus.js";
import { NotFoundError, AppError } from "../src/shared/errors/AppError.js";

describe("CONNECT Backend Foundation Smoke Test", () => {
  it("should initialize and log without throwing errors", () => {
    expect(() => Logger.info("Smoke test log executed")).not.toThrow();
  });

  it("should format standard HTTP AppError classes correctly", () => {
    const error = new NotFoundError("Test resource not found");
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe("NOT_FOUND");
    expect(error.message).toBe("Test resource not found");
  });

  it("should publish events to subscribers asynchronously in the EventBus", async () => {
    let handlerCalled = false;
    const testEvent = {
      eventName: "TestEvent",
      occurredAt: new Date(),
    };

    EventBus.subscribe("TestEvent", (event) => {
      handlerCalled = true;
      expect(event.eventName).toBe("TestEvent");
    });

    await EventBus.publish(testEvent);
    expect(handlerCalled).toBe(true);
  });

  it("should dynamically filter out 'Early Member' badge if createdAt is older than 30 days", () => {
    const computeBadges = (user) => {
      if (!user.badges) return user.badges;
      if (!user.createdAt) return user.badges;
      const days = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24);
      if (days > 30) {
        return user.badges.filter((b) => b !== "Early Member");
      }
      return user.badges;
    };

    const freshUser = {
      createdAt: new Date(),
      badges: ["Early Member", "Other Badge"],
    };

    const oldUser = {
      createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
      badges: ["Early Member", "Other Badge"],
    };

    expect(computeBadges(freshUser)).toEqual(["Early Member", "Other Badge"]);
    expect(computeBadges(oldUser)).toEqual(["Other Badge"]);
  });
});
