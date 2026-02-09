import { App, Editor, SuggestModal, Notice } from "obsidian";
import type { Template } from "../types";
import { templates } from "../data/templates";
import { assemblePrompt } from "../prompt/assemble";

export class TemplateSuggestModal extends SuggestModal<Template> {
	editor: Editor;

	constructor(app: App, editor: Editor) {
		super(app);
		this.editor = editor;
		this.setPlaceholder("Search for a prompt template...");
	}

	getSuggestions(query: string): Template[] {
		const lower = query.toLowerCase();
		if (!lower) return templates;

		return templates.filter((t) => {
			const name = (t.name ?? "").toLowerCase();
			const desc = (t.shortDescription ?? "").toLowerCase();
			const catName = (t.category?.name ?? "").toLowerCase();
			return name.includes(lower) || desc.includes(lower) || catName.includes(lower);
		});
	}

	renderSuggestion(template: Template, el: HTMLElement) {
		el.createDiv({ cls: "grab-a-prompt-suggestion-name", text: template.name ?? "" });
		el.createDiv({
			cls: "grab-a-prompt-suggestion-desc",
			text: template.shortDescription ?? "",
		});
		if (template.category?.name) {
			el.createDiv({
				cls: "grab-a-prompt-suggestion-category",
				text: template.category.name,
			});
		}
	}

	async onChooseSuggestion(template: Template) {
		if (template.hasFocusText && !this.editor.getSelection().trim()) {
			new Notice("Select text in your editor first — this template requires a selection");
			return;
		}

		const assembled = assemblePrompt(template, this.editor);
		await navigator.clipboard.writeText(assembled);
		new Notice(`Copied "${template.name}" prompt to clipboard`);
	}
}
