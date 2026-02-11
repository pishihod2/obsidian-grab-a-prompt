import { Plugin } from "obsidian";
import { SidebarView, VIEW_TYPE } from "./views/SidebarView";
import { SelectionBubble } from "./views/SelectionBubble";
import { GrabAPromptSettingTab, DEFAULT_SETTINGS } from "./settings";
import type { GrabAPromptSettings } from "./settings";
import { TemplateSuggestModal } from "./modals/TemplateSuggestModal";
import type { UserTemplate } from "./types";
import { getAllTemplates } from "./data/group";
import { templates } from "./data/templates";

export default class GrabAPromptPlugin extends Plugin {
	settings: GrabAPromptSettings = DEFAULT_SETTINGS;
	private selectionBubble: SelectionBubble | null = null;

	async onload() {
		await this.loadSettings();

		// Register the sidebar view
		this.registerView(VIEW_TYPE, (leaf) => new SidebarView(leaf, this));

		// Ribbon icon to open/reveal the sidebar
		this.addRibbonIcon("layout-grid", "Grab a prompt", () => {
			void this.activateView();
		});

		// Open the view once layout is ready (first install or if user closed it)
		this.app.workspace.onLayoutReady(() => {
			if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length === 0) {
				void this.activateView();
			}
		});

		// Command to reopen if the user closes it
		this.addCommand({
			id: "open-sidebar",
			name: "Open sidebar",
			callback: () => {
				void this.activateView();
			},
		});

		// Command: Browse templates (fuzzy modal)
		this.addCommand({
			id: "browse-templates",
			name: "Browse templates",
			editorCallback: (editor) => {
				const allTemplates = getAllTemplates(templates, this.settings.userTemplates, this.settings.showBuiltInTemplates);
				new TemplateSuggestModal(this.app, editor, allTemplates).open();
			},
		});

		// Settings tab
		this.addSettingTab(new GrabAPromptSettingTab(this.app, this));

		// Selection bubble (floating prompt input near selected text)
		if (this.settings.enableSelectionTooltip) {
			this.selectionBubble = new SelectionBubble(this);
			this.selectionBubble.register();
		}
	}

	onunload() {
		if (this.selectionBubble) {
			this.selectionBubble.destroy();
			this.selectionBubble = null;
		}
	}

	async loadSettings() {
		const saved = await this.loadData() as Record<string, unknown> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);

		// Migrate renamed setting: hideBuiltInTemplates → showBuiltInTemplates
		if (saved && "hideBuiltInTemplates" in saved && !("showBuiltInTemplates" in saved)) {
			this.settings.showBuiltInTemplates = !saved.hideBuiltInTemplates;
			await this.saveData(this.settings);
		}
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() {
		const { workspace } = this.app;

		let [leaf] = workspace.getLeavesOfType(VIEW_TYPE);

		if (!leaf) {
			leaf = workspace.getRightLeaf(false)!;
			await leaf.setViewState({ type: VIEW_TYPE, active: true });
		}

		await workspace.revealLeaf(leaf);
	}

	async addUserTemplate(ut: UserTemplate): Promise<void> {
		this.settings.userTemplates.push(ut);
		await this.saveSettings();
		this.refreshSidebar();
	}

	async updateUserTemplate(id: string, changes: Partial<UserTemplate>): Promise<void> {
		const idx = this.settings.userTemplates.findIndex((t) => t.id === id);
		if (idx >= 0) {
			Object.assign(this.settings.userTemplates[idx], changes);
			await this.saveSettings();
			this.refreshSidebar();
		}
	}

	async deleteUserTemplate(id: string): Promise<void> {
		this.settings.userTemplates = this.settings.userTemplates.filter((t) => t.id !== id);
		// Also remove from favorites
		this.settings.favorites = this.settings.favorites.filter((f) => f !== id);
		await this.saveSettings();
		this.refreshSidebar();
	}

	applySelectionBubbleSetting() {
		if (this.settings.enableSelectionTooltip) {
			if (!this.selectionBubble) {
				this.selectionBubble = new SelectionBubble(this);
				this.selectionBubble.register();
			}
		} else {
			if (this.selectionBubble) {
				this.selectionBubble.destroy();
				this.selectionBubble = null;
			}
		}
	}

	refreshSidebar() {
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE)) {
			const view = leaf.view;
			if (view instanceof SidebarView) {
				view.refreshTemplates();
			}
		}
	}
}
