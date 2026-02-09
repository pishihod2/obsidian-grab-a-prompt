import type { Editor } from "obsidian";
import type { Template } from "../types";

export function assemblePrompt(template: Template, editor: Editor): string {
	const promptText = template.prompt ?? "";
	const selection = editor.getSelection() || "";
	const document = editor.getValue() || "";

	// Step 1: start with template prompt + full document as context
	let fullPrompt = `${promptText}\n\nText:\n${document}`;

	// Step 2: if hasFocusText and there's a selection, append it
	if (template.hasFocusText && selection) {
		fullPrompt += `\n\nPart of the text to focus on:\n${selection}`;
	}

	return fullPrompt;
}

export function canCopy(template: Template, selection: string): boolean {
	if (template.hasFocusText) {
		return selection.trim() !== "";
	}
	return true;
}
