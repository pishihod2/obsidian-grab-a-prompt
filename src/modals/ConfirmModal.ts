import { Modal, App } from "obsidian";

export class ConfirmModal extends Modal {
	private message: string;
	private confirmLabel: string;
	private onConfirm: () => void;

	constructor(app: App, message: string, onConfirm: () => void, confirmLabel = "Delete") {
		super(app);
		this.message = message;
		this.confirmLabel = confirmLabel;
		this.onConfirm = onConfirm;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.addClass("grab-a-prompt-confirm-modal");

		contentEl.createEl("p", { text: this.message });

		const actions = contentEl.createDiv({
			cls: "grab-a-prompt-editor-actions",
		});

		const cancelBtn = actions.createEl("button", {
			text: "Cancel",
			cls: "grab-a-prompt-editor-cancel-btn",
		});
		cancelBtn.addEventListener("click", () => this.close());

		const confirmBtn = actions.createEl("button", {
			text: this.confirmLabel,
			cls: "grab-a-prompt-editor-save-btn grab-a-prompt-confirm-delete-btn",
		});
		confirmBtn.addEventListener("click", () => {
			this.onConfirm();
			this.close();
		});
	}

	onClose() {
		this.contentEl.empty();
	}
}
