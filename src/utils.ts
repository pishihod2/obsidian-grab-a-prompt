import { type App, MarkdownView } from "obsidian";
import type { Template } from "./types";

/**
 * Returns true if a template's name, description, or category name
 * contains the given lowercase filter string. Returns true for all
 * templates when the filter is empty.
 */
export function matchesFilter(
	template: Template,
	lowerFilter: string,
): boolean {
	if (!lowerFilter) return true;
	const name = (template.name ?? "").toLowerCase();
	const desc = (template.shortDescription ?? "").toLowerCase();
	const catName = (template.category?.name ?? "").toLowerCase();
	return (
		name.includes(lowerFilter) ||
		desc.includes(lowerFilter) ||
		catName.includes(lowerFilter)
	);
}

/**
 * Find the most recently active MarkdownView, even when a non-editor
 * pane (like the sidebar) is focused.
 *
 * Accesses the undocumented `activeTime` property on WorkspaceLeaf.
 */
export function getActiveMarkdownView(app: App): MarkdownView | null {
	const leaves = app.workspace.getLeavesOfType("markdown");
	if (leaves.length === 0) return null;

	let best = leaves[0];
	let bestTime = (best as any).activeTime ?? 0;
	for (let i = 1; i < leaves.length; i++) {
		const t = (leaves[i] as any).activeTime ?? 0;
		if (t > bestTime) {
			best = leaves[i];
			bestTime = t;
		}
	}

	const view = best.view;
	if (view instanceof MarkdownView) return view;
	return null;
}
