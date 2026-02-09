import { ItemView, WorkspaceLeaf, MarkdownView, Notice, type EventRef } from "obsidian";
import type GrabAPromptPlugin from "../main";
import type { Template, TemplateGroup } from "../types";
import { templates } from "../data/templates";
import { groupTemplatesByCategory } from "../data/group";
import { assemblePrompt } from "../prompt/assemble";

export const VIEW_TYPE = "grab-a-prompt-sidebar";

export class SidebarView extends ItemView {
	plugin: GrabAPromptPlugin;
	private groups: TemplateGroup[];
	private selectedTemplate: Template | null = null;
	private selectionEventRefs: EventRef[] = [];
	private selectionChangeDomHandler: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, plugin: GrabAPromptPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.groups = groupTemplatesByCategory(templates);
	}

	getViewType(): string {
		return VIEW_TYPE;
	}

	getDisplayText(): string {
		return "Grab a Prompt";
	}

	getIcon(): string {
		return "layout-grid";
	}

	async onOpen() {
		this.renderList();
	}

	async onClose() {
		this.unregisterSelectionListener();
	}

	private getMarkdownEditor() {
		// getActiveViewOfType won't work when the sidebar is focused,
		// so find the most recent markdown leaf manually
		const leaves = this.app.workspace.getLeavesOfType("markdown");
		if (leaves.length === 0) return null;

		// Prefer the most recently active leaf
		const sorted = leaves.sort(
			(a, b) => ((b as any).activeTime ?? 0) - ((a as any).activeTime ?? 0)
		);
		const view = sorted[0].view;
		if (view instanceof MarkdownView) return view.editor;
		return null;
	}

	private isFavorite(template: Template): boolean {
		return this.plugin.settings.favorites.includes(template.id);
	}

	private async toggleFavorite(template: Template) {
		const favs = this.plugin.settings.favorites;
		const idx = favs.indexOf(template.id);
		if (idx >= 0) {
			favs.splice(idx, 1);
		} else {
			favs.push(template.id);
		}
		await this.plugin.saveSettings();
	}

	private renderList(filter = "") {
		this.unregisterSelectionListener();
		this.selectedTemplate = null;

		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("grab-a-prompt-container");

		// Search input
		const searchContainer = container.createDiv({ cls: "grab-a-prompt-search" });
		const searchInput = searchContainer.createEl("input", {
			type: "text",
			placeholder: "Search templates...",
			cls: "grab-a-prompt-search-input",
		});
		searchInput.value = filter;
		searchInput.addEventListener("input", () => {
			this.renderList(searchInput.value);
		});

		const lowerFilter = filter.toLowerCase();

		// Template groups
		const listContainer = container.createDiv({ cls: "grab-a-prompt-list" });

		// Track hasFocusText items so we can update their disabled state
		const focusTextItems: { el: HTMLElement; template: Template }[] = [];

		// Favorites group (shown at top)
		const favoriteTemplates = templates.filter((t) => {
			if (!this.isFavorite(t)) return false;
			if (!lowerFilter) return true;
			const name = (t.name ?? "").toLowerCase();
			const desc = (t.shortDescription ?? "").toLowerCase();
			const catName = (t.category?.name ?? "").toLowerCase();
			return name.includes(lowerFilter) || desc.includes(lowerFilter) || catName.includes(lowerFilter);
		});

		if (favoriteTemplates.length > 0) {
			const favCategoryEl = listContainer.createDiv({ cls: "grab-a-prompt-category" });
			const favHeader = favCategoryEl.createDiv({ cls: "grab-a-prompt-category-header" });
			favHeader.createSpan({ cls: "grab-a-prompt-category-symbol grab-a-prompt-fav-symbol", text: "\u2605" });
			favHeader.createSpan({ cls: "grab-a-prompt-category-name", text: "Favorites" });

			for (const template of favoriteTemplates) {
				this.renderTemplateItem(favCategoryEl, template, focusTextItems);
			}
		}

		// Regular category groups
		for (const group of this.groups) {
			const matchingTemplates = group.templates.filter((t) => {
				if (!lowerFilter) return true;
				const name = (t.name ?? "").toLowerCase();
				const desc = (t.shortDescription ?? "").toLowerCase();
				const catName = (group.category.name ?? "").toLowerCase();
				return name.includes(lowerFilter) || desc.includes(lowerFilter) || catName.includes(lowerFilter);
			});

			if (matchingTemplates.length === 0) continue;

			// Category header
			const categoryEl = listContainer.createDiv({ cls: "grab-a-prompt-category" });
			const categoryHeader = categoryEl.createDiv({ cls: "grab-a-prompt-category-header" });
			categoryHeader.createSpan({ cls: "grab-a-prompt-category-symbol", text: "\u25A0" });
			categoryHeader.createSpan({ cls: "grab-a-prompt-category-name", text: group.category.name ?? "" });

			if (group.category.subheader) {
				categoryEl.createDiv({
					cls: "grab-a-prompt-category-subheader",
					text: group.category.subheader,
				});
			}

			// Template items
			for (const template of matchingTemplates) {
				this.renderTemplateItem(categoryEl, template, focusTextItems);
			}
		}

		// Update disabled state for hasFocusText items
		const updateDisabledStates = () => {
			const editor = this.getMarkdownEditor();
			const hasSelection = !!(editor?.getSelection()?.trim());

			for (const { el } of focusTextItems) {
				if (hasSelection) {
					el.removeClass("grab-a-prompt-item-disabled");
				} else {
					el.addClass("grab-a-prompt-item-disabled");
				}
			}
		};

		if (focusTextItems.length > 0) {
			updateDisabledStates();
			this.registerSelectionListener(updateDisabledStates);
		}

		// Focus search input if there's already a filter
		if (filter) {
			searchInput.focus();
			searchInput.setSelectionRange(filter.length, filter.length);
		}
	}

	private renderTemplateItem(
		parentEl: HTMLElement,
		template: Template,
		focusTextItems: { el: HTMLElement; template: Template }[],
	) {
		const itemEl = parentEl.createDiv({ cls: "grab-a-prompt-item" });

		itemEl.createDiv({ cls: "grab-a-prompt-item-name", text: template.name ?? "" });
		itemEl.createDiv({
			cls: "grab-a-prompt-item-desc",
			text: template.shortDescription ?? "",
		});

		// Favorite star button — visible on hover (or always if favorited)
		const starBtn = itemEl.createEl("button", {
			cls: "grab-a-prompt-item-star-btn",
			attr: { "aria-label": "Toggle favorite" },
		});
		starBtn.setText(this.isFavorite(template) ? "\u2605" : "\u2606");
		if (this.isFavorite(template)) {
			starBtn.addClass("grab-a-prompt-item-star-active");
		}
		starBtn.addEventListener("click", async (e) => {
			e.stopPropagation();
			await this.toggleFavorite(template);
			// Re-render to move item in/out of favorites group
			this.renderList();
		});

		// "View details" button — visible on hover
		const detailBtn = itemEl.createEl("button", {
			cls: "grab-a-prompt-item-detail-btn",
			attr: { "aria-label": "View template details" },
		});
		detailBtn.setText("\u2192");
		detailBtn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.renderDetail(template);
		});

		if (template.hasFocusText) {
			focusTextItems.push({ el: itemEl, template });
		}

		// Click = copy prompt
		itemEl.addEventListener("click", () => {
			this.handleItemCopy(template, itemEl);
		});
	}

	private async handleItemCopy(template: Template, itemEl: HTMLElement) {
		const editor = this.getMarkdownEditor();
		if (!editor) {
			new Notice("No active editor \u2014 open a note first");
			return;
		}

		if (template.hasFocusText && !editor.getSelection()?.trim()) {
			new Notice("Select text in your editor first \u2014 this template needs a selection");
			return;
		}

		const assembled = assemblePrompt(template, editor);
		await navigator.clipboard.writeText(assembled);

		new Notice(`Copied to clipboard: ${template.name}`);
	}

	private renderDetail(template: Template) {
		this.selectedTemplate = template;

		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();
		container.addClass("grab-a-prompt-container");

		// Back button
		const backBtn = container.createEl("button", {
			cls: "grab-a-prompt-back-btn",
			text: "\u2190 Back",
		});
		backBtn.addEventListener("click", () => {
			this.renderList();
		});

		// Template name + favorite toggle
		const nameRow = container.createDiv({ cls: "grab-a-prompt-detail-name-row" });
		nameRow.createSpan({ cls: "grab-a-prompt-detail-name", text: template.name ?? "" });
		const detailStarBtn = nameRow.createEl("button", {
			cls: "grab-a-prompt-detail-star-btn",
			attr: { "aria-label": "Toggle favorite" },
		});
		detailStarBtn.setText(this.isFavorite(template) ? "\u2605" : "\u2606");
		if (this.isFavorite(template)) {
			detailStarBtn.addClass("grab-a-prompt-detail-star-active");
		}
		detailStarBtn.addEventListener("click", async () => {
			await this.toggleFavorite(template);
			const isFav = this.isFavorite(template);
			detailStarBtn.setText(isFav ? "\u2605" : "\u2606");
			detailStarBtn.toggleClass("grab-a-prompt-detail-star-active", isFav);
		});

		// Short description
		if (template.shortDescription) {
			container.createDiv({ cls: "grab-a-prompt-detail-desc", text: template.shortDescription });
		}

		// Prompt preview with placeholder badges
		const promptPreview = container.createDiv({ cls: "grab-a-prompt-prompt-preview" });
		this.renderPromptWithBadges(promptPreview, template.prompt ?? "");

		// Hint for hasFocusText templates
		const hintEl = container.createDiv({ cls: "grab-a-prompt-hint" });

		// Copy button
		const copyBtn = container.createEl("button", {
			cls: "grab-a-prompt-copy-btn",
			text: "Copy prompt + text to clipboard",
		});

		const updateCopyState = () => {
			const editor = this.getMarkdownEditor();
			const selection = editor?.getSelection() || "";

			if (template.hasFocusText && !selection.trim()) {
				hintEl.setText("Select text in editor to use this template");
				hintEl.show();
				copyBtn.disabled = true;
				copyBtn.addClass("grab-a-prompt-btn-disabled");
			} else {
				hintEl.setText("");
				hintEl.hide();
				copyBtn.disabled = false;
				copyBtn.removeClass("grab-a-prompt-btn-disabled");
			}
		};

		updateCopyState();

		// Listen for selection changes if hasFocusText
		if (template.hasFocusText) {
			this.registerSelectionListener(updateCopyState);
		}

		copyBtn.addEventListener("click", async () => {
			const editor = this.getMarkdownEditor();
			if (!editor) {
				new Notice("No active editor — open a note first");
				return;
			}

			const assembled = assemblePrompt(template, editor);
			await navigator.clipboard.writeText(assembled);

			copyBtn.setText("Copied!");
			setTimeout(() => {
				copyBtn.setText("Copy prompt + text to clipboard");
			}, 3000);

			new Notice("Prompt copied to clipboard");
		});
	}

	private renderPromptWithBadges(container: HTMLElement, text: string) {
		const parts = text.split(/({{selected}}|{{paragraph}}|{{document}})/g);

		for (const part of parts) {
			if (part === "{{selected}}") {
				container.createSpan({ cls: "grab-a-prompt-badge", text: "selection" });
			} else if (part === "{{paragraph}}") {
				container.createSpan({ cls: "grab-a-prompt-badge", text: "paragraph" });
			} else if (part === "{{document}}") {
				container.createSpan({ cls: "grab-a-prompt-badge", text: "document" });
			} else {
				container.createSpan({ text: part });
			}
		}
	}

	private registerSelectionListener(callback: () => void) {
		this.unregisterSelectionListener();

		const ref1 = this.app.workspace.on("active-leaf-change", callback);
		const ref2 = this.app.workspace.on("editor-change", callback);
		this.registerEvent(ref1);
		this.registerEvent(ref2);
		this.selectionEventRefs = [ref1, ref2];

		// editor-change doesn't fire on selection change, so listen for that via DOM
		let timeout: number;
		const debounced = () => {
			clearTimeout(timeout);
			timeout = window.setTimeout(callback, 100);
		};
		activeWindow.document.addEventListener("selectionchange", debounced);
		this.selectionChangeDomHandler = debounced;
	}

	private unregisterSelectionListener() {
		for (const ref of this.selectionEventRefs) {
			this.app.workspace.offref(ref);
		}
		this.selectionEventRefs = [];

		if (this.selectionChangeDomHandler) {
			activeWindow.document.removeEventListener("selectionchange", this.selectionChangeDomHandler);
			this.selectionChangeDomHandler = null;
		}
	}
}
