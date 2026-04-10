import { describe, expect, it } from "vitest";
import {
  addPersistentContextItem,
  clearPersistentContextItems,
  removePersistentContextItem
} from "../src/persistent-context";

describe("persistent-context", () => {
  it("deduplicates files when adding a new persistent context item", () => {
    const items = addPersistentContextItem(
      [
        {
          kind: "vault-file",
          path: "notes/roadmap.md"
        }
      ],
      {
        kind: "vault-file",
        path: "notes/roadmap.md"
      }
    );

    expect(items).toEqual([
      {
        kind: "vault-file",
        path: "notes/roadmap.md"
      }
    ]);
  });

  it("removes the requested path from persistent context items", () => {
    const items = removePersistentContextItem(
      [
        {
          kind: "vault-file",
          path: "notes/roadmap.md"
        },
        {
          kind: "vault-file",
          path: "notes/spec.md"
        }
      ],
      "notes/roadmap.md"
    );

    expect(items).toEqual([
      {
        kind: "vault-file",
        path: "notes/spec.md"
      }
    ]);
  });

  it("clears all persistent context items for the current session", () => {
    expect(
      clearPersistentContextItems([
        {
          kind: "vault-file",
          path: "notes/roadmap.md"
        }
      ])
    ).toEqual([]);
  });

  it("uses the same vault-file shape as pin current note", () => {
    const items = addPersistentContextItem([], {
      kind: "vault-file",
      path: "notes/current.md"
    });

    expect(items[0]).toEqual({
      kind: "vault-file",
      path: "notes/current.md"
    });
  });
});
