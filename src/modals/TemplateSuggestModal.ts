import { App, Editor, SuggestModal, Notice } from "obsidian";
import type { Template } from "../types";
import { assemblePrompt, canCopy } from "../prompt/assemble";
import { matchesFilter } from "../utils";

export class TemplateSuggestModal extends SuggestModal<Template> {
	editor: Editor;
	private allTemplates: Template[];

	constructor(app: App, editor: Editor, allTemplates: Template[]) {
		super(app);
		this.editor = editor;
		this.allTemplates = allTemplates;
		this.setPlaceholder("Search for a prompt template...");
	}

	getSuggestions(query: string): Template[] {
		const lower = query.toLowerCase();
		if (!lower) return this.allTemplates;
		return this.allTemplates.filter((t) => matchesFilter(t, lower));
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
		if (!canCopy(template, this.editor.getSelection())) {
			new Notice("Select text in your editor first — this template requires a selection");
			return;
		}

		const assembled = assemblePrompt(template, this.editor);
		await navigator.clipboard.writeText(assembled);
		new Notice(`Copied "${template.name}" prompt to clipboard`);
	}
}
