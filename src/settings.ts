import { PluginSettingTab, App, Setting } from "obsidian";
import type GrabAPromptPlugin from "./main";
import type { UserTemplate } from "./types";

export interface GrabAPromptSettings {
  favorites: (number | string)[];
  userTemplates: UserTemplate[];
  enableSelectionTooltip: boolean;
  enableQuickPrompt: boolean;
  enableMyTemplates: boolean;
  showBuiltInTemplates: boolean;
  collapsedCategories: string[];
}

export const DEFAULT_SETTINGS: GrabAPromptSettings = {
  favorites: [],
  userTemplates: [],
  enableSelectionTooltip: true,
  enableQuickPrompt: true,
  enableMyTemplates: true,
  showBuiltInTemplates: true,
  collapsedCategories: [],
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

    containerEl.createEl("h2", {
      text: "Grab a prompt",
    });

    containerEl.createEl("p", {
      text: "Ready-made AI prompt templates for writers and everyone working on with texts.",
    });

    containerEl.createEl("p", {
      text: "Click the 'Grab a Prompt' icon on the ribbon to open a panel in the right sidebar. Click any template to copy a prompt to your clipboard. Your current document will be injected automatically. So you can paste it into ChatGPT, Claude, Gemini or any other LLM. Star your favorite prompts to access them quickly.",
    });

    containerEl.createEl("h3", {
      text: "Templates with selection",
    });

    containerEl.createEl("p", {
      text: "Some templates need a specific part of your text to work. You have to select text in the editor to enable them. The selected text will be inserted into the prompt along with the text.",
    });

    containerEl.createEl("h3", {
      text: "Your own prompts",
    });

    containerEl.createEl("p", {
      text: "You can also set up you own templates, write a one-off prompt for the entire document (QUICK PROMPT) and copy a prompt focusing on specific part of the text (just select a text and click the tooltip button).",
    });

    const linkP = containerEl.createEl("p");
    linkP.createSpan({ text: "The plugin is supported by " });
    linkP.createEl("a", {
      text: "grabaprompt.com",
      href: "https://grabaprompt.com",
    });
    linkP.createSpan({
      text: ". Suggest new prompts and improvements on the website!",
    });

    containerEl.createEl("h3", { text: "Features" });

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
        desc: "Show the Quick Prompt text field at the top of the sidebar.",
        key: "enableQuickPrompt",
      },
      {
        name: "My Templates",
        desc: "Show My Templates section for creating custom prompt templates.",
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
  }
}
