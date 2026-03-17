import { addIcon } from "obsidian";
import { buildCodexIconSvg, CODEX_ICON } from "./codex-icon";

export function registerCodexIcon(): void {
  addIcon(CODEX_ICON, buildCodexIconSvg());
}
