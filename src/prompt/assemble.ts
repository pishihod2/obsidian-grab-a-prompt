import type { Editor } from "obsidian";
import type { Template } from "../types";

export function assemblePrompt(template: Template, editor: Editor): string {
	const promptText = template.prompt ?? "";
	const selection = editor.getSelection() || "";
	const document = editor.getValue() || "";

	let fullPrompt = "MY TEXT:\n===\n" + document + "\n===\n\n";

	if (template.hasFocusText && selection) {
		fullPrompt += "FOCUS ON THIS PART:\n===\n" + selection + "\n===\n\n";
	}

	fullPrompt += promptText;

	return fullPrompt;
}

export function canCopy(template: Template, selection: string): boolean {
	if (template.hasFocusText) {
		return selection.trim() !== "";
	}
	return true;
}

export function assembleQuickPrompt(
	documentText: string,
	userInput: string,
): string {
	return "MY TEXT:\n===\n" + documentText + "\n===\n\n" + userInput;
}

export function assembleSelectionBubblePrompt(
	documentText: string,
	selectedText: string,
	userInput: string,
): string {
	return (
		"MY TEXT:\n===\n" +
		documentText +
		"\n===\n\n" +
		"FOCUS ON THIS PART:\n===\n" +
		selectedText +
		"\n===\n\n" +
		userInput
	);
}
