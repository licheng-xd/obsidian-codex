import { describe, expect, it, vi } from "vitest";
import { cancelActiveTurn } from "../src/chat-runtime-controller";

describe("chat runtime controller", () => {
  it("does nothing when no turn is sending", () => {
    const cancelCurrentTurn = vi.fn();
    const state = {
      isSending: false,
      wasCancelled: false
    };

    cancelActiveTurn({
      state,
      cancelCurrentTurn
    });

    expect(state.wasCancelled).toBe(false);
    expect(cancelCurrentTurn).not.toHaveBeenCalled();
  });

  it("marks cancellation and cancels the current turn when sending", () => {
    const cancelCurrentTurn = vi.fn();
    const state = {
      isSending: true,
      wasCancelled: false
    };

    cancelActiveTurn({
      state,
      cancelCurrentTurn
    });

    expect(state.wasCancelled).toBe(true);
    expect(cancelCurrentTurn).toHaveBeenCalledTimes(1);
  });
});
