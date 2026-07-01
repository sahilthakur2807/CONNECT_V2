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
});
