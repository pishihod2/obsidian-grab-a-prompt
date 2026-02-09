import { Plugin, WorkspaceLeaf } from "obsidian";
import { SidebarView, VIEW_TYPE } from "./views/SidebarView";
import { GrabAPromptSettingTab, DEFAULT_SETTINGS } from "./settings";
import type { GrabAPromptSettings } from "./settings";
import { TemplateSuggestModal } from "./modals/TemplateSuggestModal";

export default class GrabAPromptPlugin extends Plugin {
	settings: GrabAPromptSettings = DEFAULT_SETTINGS;

	async onload() {
		await this.loadSettings();

		// Register the sidebar view
		this.registerView(VIEW_TYPE, (leaf) => new SidebarView(leaf, this));

		// Ribbon icon to open/reveal the sidebar
		this.addRibbonIcon("layout-grid", "Grab a Prompt", () => {
			this.activateView();
		});

		// Open the view once layout is ready (first install or if user closed it)
		this.app.workspace.onLayoutReady(() => {
			if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length === 0) {
				this.activateView();
			}
		});

		// Command to reopen if the user closes it
		this.addCommand({
			id: "open-sidebar",
			name: "Open Grab a Prompt",
			callback: () => {
				this.activateView();
			},
		});

		// Command: Browse templates (fuzzy modal)
		this.addCommand({
			id: "browse-templates",
			name: "Browse templates",
			editorCallback: (editor) => {
				new TemplateSuggestModal(this.app, editor).open();
			},
		});

		// Settings tab
		this.addSettingTab(new GrabAPromptSettingTab(this.app, this));
	}

	onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async activateView() {
		const { workspace } = this.app;

		let [leaf] = workspace.getLeavesOfType(VIEW_TYPE);

		if (!leaf) {
			// Add as a tab in the right sidebar's existing tab group
			// (getRightLeaf(false) hijacks a leaf, true creates a separate split)
			const tabGroup = (workspace.rightSplit as any).children[0];
			if (tabGroup) {
				leaf = workspace.createLeafInParent(
					tabGroup as any,
					tabGroup.children.length,
				);
			} else {
				leaf = workspace.getRightLeaf(false)!;
			}
			await leaf.setViewState({ type: VIEW_TYPE, active: true });
		}

		workspace.revealLeaf(leaf);
	}
}
