import { Modal, App } from "obsidian";
import type GrabAPromptPlugin from "../main";
import type { UserTemplate } from "../types";

export class TemplateEditorModal extends Modal {
	private plugin: GrabAPromptPlugin;
	private existing: UserTemplate | null;

	constructor(app: App, plugin: GrabAPromptPlugin, existing?: UserTemplate) {
		super(app);
		this.plugin = plugin;
		this.existing = existing ?? null;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("grab-a-prompt-editor-modal");

		contentEl.createEl("h3", {
			text: this.existing ? "Edit template" : "New template",
		});

		// Name field
		const nameField = contentEl.createDiv({ cls: "grab-a-prompt-editor-field" });
		nameField.createEl("label", { text: "Name" });
		const nameInput = nameField.createEl("input", {
			type: "text",
			placeholder: "Template name",
			cls: "grab-a-prompt-editor-input",
		});
		nameInput.value = this.existing?.name ?? "";
		nameInput.maxLength = 100;

		// Short description field
		const descField = contentEl.createDiv({ cls: "grab-a-prompt-editor-field" });
		descField.createEl("label", { text: "Short description" });
		const descInput = descField.createEl("input", {
			type: "text",
			placeholder: "One-line description for the list view",
			cls: "grab-a-prompt-editor-input",
		});
		descInput.value = this.existing?.shortDescription ?? "";

		// Prompt field
		const promptField = contentEl.createDiv({ cls: "grab-a-prompt-editor-field" });
		promptField.createEl("label", { text: "Prompt" });
		const promptInput = promptField.createEl("textarea", {
			placeholder: "Write your prompt template here...",
			cls: "grab-a-prompt-editor-textarea",
		});
		promptInput.value = this.existing?.prompt ?? "";

		// Placeholder hint
		promptField.createDiv({
			cls: "grab-a-prompt-editor-hint",
			text: "The full note text is always appended. If \"Requires selection\" is on, the selected text is also appended.",
		});

		// Requires selection toggle
		const toggleField = contentEl.createDiv({ cls: "grab-a-prompt-editor-toggle" });
		const toggleLabel = toggleField.createEl("label");
		const checkbox = toggleLabel.createEl("input", { type: "checkbox" });
		checkbox.checked = this.existing?.hasFocusText ?? false;
		toggleLabel.createSpan({ text: " Requires selection" });

		// Error display
		const errorEl = contentEl.createDiv({ cls: "grab-a-prompt-editor-error" });
		errorEl.hide();

		// Action buttons
		const actions = contentEl.createDiv({ cls: "grab-a-prompt-editor-actions" });

		const cancelBtn = actions.createEl("button", {
			text: "Cancel",
			cls: "grab-a-prompt-editor-cancel-btn",
		});

		const saveBtn = actions.createEl("button", {
			text: this.existing ? "Save" : "Create",
			cls: "grab-a-prompt-editor-save-btn",
		});

		saveBtn.addEventListener("click", () => {
			const name = nameInput.value.trim();
			const prompt = promptInput.value.trim();
			const shortDescription = descInput.value.trim();

			if (!name || !prompt) {
				errorEl.setText("Name and prompt are required.");
				errorEl.show();
				return;
			}

			const save = this.existing
				? this.plugin.updateUserTemplate(this.existing.id, {
					name,
					prompt,
					shortDescription,
					hasFocusText: checkbox.checked,
				})
				: this.plugin.addUserTemplate({
					id: crypto.randomUUID(),
					name,
					prompt,
					shortDescription,
					hasFocusText: checkbox.checked,
				});

			void save.then(() => {
				this.close();
			});
		});

		cancelBtn.addEventListener("click", () => {
			this.close();
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}
