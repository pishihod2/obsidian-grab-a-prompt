import { PluginSettingTab, App, Setting } from "obsidian";
import type GrabAPromptPlugin from "./main";
import type { UserTemplate } from "./types";
import { icanwriteUrl } from "./links";

export interface GrabAPromptSettings {
  favorites: string[];
  userTemplates: UserTemplate[];
  enableSelectionTooltip: boolean;
  enableQuickPrompt: boolean;
  enableMyTemplates: boolean;
  showBuiltInTemplates: boolean;
  collapsedCategories: string[];
  showIcanwriteLinks: boolean;
}

export const DEFAULT_SETTINGS: GrabAPromptSettings = {
  favorites: [],
  userTemplates: [],
  enableSelectionTooltip: true,
  enableQuickPrompt: true,
  enableMyTemplates: true,
  showBuiltInTemplates: true,
  collapsedCategories: [],
  showIcanwriteLinks: true,
};

export class GrabAPromptSettingTab extends PluginSettingTab {
  plugin: GrabAPromptPlugin;

  constructor(app: App, plugin: GrabAPromptPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("grab-a-prompt-settings");

    new Setting(containerEl).setName("Features").setHeading();

    const toggles: {
      name: string;
      desc: string;
      key: keyof GrabAPromptSettings;
      onAfterSave?: () => void;
    }[] = [
      {
        name: "Selection tooltip",
        desc: "Show a prompt button near selected text in the editor.",
        key: "enableSelectionTooltip",
        onAfterSave: () => this.plugin.applySelectionBubbleSetting(),
      },
      {
        name: "Quick prompt",
        desc: "Show the quick prompt text field at the top of the sidebar.",
        key: "enableQuickPrompt",
      },
      {
        name: "My templates",
        desc: "Show a section for creating custom prompt templates.",
        key: "enableMyTemplates",
      },
      {
        name: "Built-in templates",
        desc: "Show built-in template library.",
        key: "showBuiltInTemplates",
      },
    ];

    for (const { name, desc, key, onAfterSave } of toggles) {
      new Setting(containerEl)
        .setName(name)
        .setDesc(desc)
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings[key] as boolean)
            .onChange(async (value) => {
              (this.plugin.settings[key] as boolean) = value;
              await this.plugin.saveSettings();
              if (onAfterSave) {
                onAfterSave();
              } else {
                this.plugin.refreshSidebar();
              }
            }),
        );
    }

    new Setting(containerEl).setName("About").setHeading();

    new Setting(containerEl)
      .setName("Made by icanwrite")
      .setDesc("This plugin is made by icanwrite, a free Markdown editor that runs AI editing checks like these on your drafts and returns the feedback as sidebar comments, each tied to the passage it refers to. Works with Obsidian vaults.")
      .addButton((button) =>
        button
          .setButtonText("Visit icanwrite")
          .onClick(() => {
            window.open(icanwriteUrl("settings"));
          }),
      );

    new Setting(containerEl)
      .setName("Show icanwrite links")
      .setDesc("Show links to icanwrite in the sidebar.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showIcanwriteLinks)
          .onChange(async (value) => {
            this.plugin.settings.showIcanwriteLinks = value;
            await this.plugin.saveSettings();
            this.plugin.refreshSidebar();
          }),
      );
  }
}
