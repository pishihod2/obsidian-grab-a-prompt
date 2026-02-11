import { MarkdownView, Notice, setIcon, type EventRef } from "obsidian";
import type GrabAPromptPlugin from "../main";
import { getActiveMarkdownView } from "../utils";
import { assembleSelectionBubblePrompt } from "../prompt/assemble";

interface CmView {
	scrollDOM: HTMLElement;
	coordsAtPos(pos: number, side?: number): { top: number; bottom: number; left: number; right: number } | null;
}

interface SelectionSnapshot {
	selectedText: string;
	documentText: string;
	offset: number;
	cmView: CmView;
}

export class SelectionBubble {
	private plugin: GrabAPromptPlugin;
	private bubbleEl: HTMLElement | null = null;
	private isExpanded = false;
	private snapshot: SelectionSnapshot | null = null;

	private selectionChangeHandler: (() => void) | null = null;
	private scrollHandler: (() => void) | null = null;
	private clickOutsideHandler: ((e: MouseEvent) => void) | null = null;
	private debounceTimer: number = 0;
	private eventRefs: EventRef[] = [];

	constructor(plugin: GrabAPromptPlugin) {
		this.plugin = plugin;
	}

	register(): void {
		const debounced = () => {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = window.setTimeout(() => this.onSelectionChange(), 150);
		};
		activeWindow.document.addEventListener("selectionchange", debounced);
		this.selectionChangeHandler = debounced;

		const ref = this.plugin.app.workspace.on("active-leaf-change", () => {
			this.hideBubble();
		});
		this.plugin.registerEvent(ref);
		this.eventRefs.push(ref);
	}

	destroy(): void {
		this.hideBubble();

		if (this.selectionChangeHandler) {
			activeWindow.document.removeEventListener("selectionchange", this.selectionChangeHandler);
			this.selectionChangeHandler = null;
		}

		for (const ref of this.eventRefs) {
			this.plugin.app.workspace.offref(ref);
		}
		this.eventRefs = [];

		clearTimeout(this.debounceTimer);
	}

	// ---- Private ----

	private onSelectionChange(): void {
		// Don't interfere when the bubble input is focused
		if (this.isExpanded) return;

		const mdView = getActiveMarkdownView(this.plugin.app);
		if (!mdView) {
			this.hideBubble();
			return;
		}

		const editor = mdView.editor;
		const selection = editor.getSelection();

		if (!selection || !selection.trim()) {
			this.hideBubble();
			return;
		}

		const cmView = this.getCmView(mdView);
		if (!cmView) {
			this.hideBubble();
			return;
		}

		const cursorTo = editor.getCursor("to");
		const offset = editor.posToOffset(cursorTo);

		this.snapshot = {
			selectedText: selection,
			documentText: editor.getValue(),
			offset,
			cmView,
		};

		this.showBubble();
	}

	private getCmView(mdView: MarkdownView): CmView | null {
		const cm = (mdView.editor as unknown as { cm?: CmView }).cm;
		return cm ?? null;
	}

	private showBubble(): void {
		if (!this.snapshot) return;

		if (!this.bubbleEl) {
			this.bubbleEl = activeWindow.document.body.createDiv({
				cls: "grab-a-prompt-bubble",
			});

			const iconBtn = this.bubbleEl.createDiv({
				cls: "grab-a-prompt-bubble-trigger",
			});
			const iconSpan = iconBtn.createSpan({ cls: "grab-a-prompt-bubble-icon" });
				setIcon(iconSpan, "sparkles");
			iconBtn.createSpan({ cls: "grab-a-prompt-bubble-label", text: "Prompt with selection" });
			iconBtn.addEventListener("click", (e) => {
				e.stopPropagation();
				this.expandBubble();
			});

			// Reposition on scroll
			this.scrollHandler = () => this.positionBubble();
			this.snapshot.cmView.scrollDOM.addEventListener("scroll", this.scrollHandler, { passive: true });
		}

		this.positionBubble();
	}

	private positionBubble(): void {
		if (!this.bubbleEl || !this.snapshot) return;

		const coords = this.snapshot.cmView.coordsAtPos(this.snapshot.offset, 1);
		if (!coords) {
			this.bubbleEl.addClass("grab-a-prompt-bubble-hidden");
			return;
		}

		this.bubbleEl.removeClass("grab-a-prompt-bubble-hidden");

		const GAP = 8;
		const bubbleHeight = this.bubbleEl.offsetHeight || 32;

		// Default: above the selection end
		let top = coords.top - bubbleHeight - GAP;
		let left = coords.right + 4;

		// Fall back to below if too close to viewport top
		if (top < 10) {
			top = coords.bottom + GAP;
		}

		// Clamp horizontally
		const vw = activeWindow.innerWidth;
		const bubbleWidth = this.bubbleEl.offsetWidth || 32;
		if (left + bubbleWidth > vw - 10) {
			left = vw - bubbleWidth - 10;
		}
		if (left < 10) left = 10;

		this.bubbleEl.style.top = `${top}px`;
		this.bubbleEl.style.left = `${left}px`;
	}

	private hideBubble(): void {
		if (this.bubbleEl) {
			if (this.scrollHandler && this.snapshot?.cmView) {
				this.snapshot.cmView.scrollDOM.removeEventListener("scroll", this.scrollHandler);
				this.scrollHandler = null;
			}

			if (this.clickOutsideHandler) {
				activeWindow.document.removeEventListener("mousedown", this.clickOutsideHandler);
				this.clickOutsideHandler = null;
			}

			this.bubbleEl.remove();
			this.bubbleEl = null;
		}

		this.isExpanded = false;
		this.snapshot = null;
	}

	private expandBubble(): void {
		if (!this.bubbleEl || this.isExpanded) return;
		this.isExpanded = true;

		this.bubbleEl.empty();
		this.bubbleEl.addClass("grab-a-prompt-bubble-expanded");

		const input = this.bubbleEl.createEl("textarea", {
			cls: "grab-a-prompt-bubble-input",
			attr: {
				placeholder: "What should the AI do with this?",
				rows: "2",
			},
		});

		const sendBtn = this.bubbleEl.createEl("button", {
			cls: "grab-a-prompt-bubble-send",
			text: "Copy prompt to clipboard",
		});

		setTimeout(() => input.focus(), 0);

		sendBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			const value = input.value.trim();
			if (value) void this.handleSubmit(value);
		});

		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				const value = input.value.trim();
				if (value) void this.handleSubmit(value);
			}
			if (e.key === "Escape") {
				this.hideBubble();
			}
		});

		// Click outside to dismiss (delayed to avoid catching the current click)
		setTimeout(() => {
			this.clickOutsideHandler = (e: MouseEvent) => {
				if (this.bubbleEl && !this.bubbleEl.contains(e.target as Node)) {
					this.hideBubble();
				}
			};
			activeWindow.document.addEventListener("mousedown", this.clickOutsideHandler);
		}, 0);

		// Reposition since the bubble is now larger
		this.positionBubble();
	}

	private async handleSubmit(userInput: string): Promise<void> {
		if (!this.snapshot) return;

		const assembled = assembleSelectionBubblePrompt(
			this.snapshot.documentText,
			this.snapshot.selectedText,
			userInput,
		);

		await navigator.clipboard.writeText(assembled);
		new Notice("Prompt copied to clipboard");
		this.hideBubble();
	}
}
