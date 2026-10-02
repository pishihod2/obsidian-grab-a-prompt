import { PluginSettingTab, App, Setting, type SettingDefinitionItem } from "obsidian";
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

type ToggleKey =
  | "enableSelectionTooltip"
  | "enableQuickPrompt"
  | "enableMyTemplates"
  | "showBuiltInTemplates"
  | "showIcanwriteLinks";

interface ToggleSpec {
  name: string;
  desc: string;
  key: ToggleKey;
}

const FEATURE_TOGGLES: ToggleSpec[] = [
  {
    name: "Selection tooltip",
    desc: "Show a prompt button near selected text in the editor.",
    key: "enableSelectionTooltip",
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

const LINKS_TOGGLE: ToggleSpec = {
  name: "Show icanwrite links",
  desc: "Show links to icanwrite in the sidebar.",
  key: "showIcanwriteLinks",
};

const ABOUT = {
  name: "Made by icanwrite",
  desc: "This plugin is made by icanwrite, a free Markdown editor that runs AI editing checks like these on your drafts and returns the feedback as sidebar comments, each tied to the passage it refers to. Works with Obsidian vaults.",
};

const TOGGLE_KEYS = new Set<string>([...FEATURE_TOGGLES, LINKS_TOGGLE].map((t) => t.key));

function isToggleKey(key: string): key is ToggleKey {
  return TOGGLE_KEYS.has(key);
}

export class GrabAPromptSettingTab extends PluginSettingTab {
  plugin: GrabAPromptPlugin;

  constructor(app: App, plugin: GrabAPromptPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // Obsidian 1.13+: rendered by Obsidian and indexed for settings search.
  // Older versions ignore this and call display() below.
  getSettingDefinitions(): SettingDefinitionItem[] {
    const toggle = ({ name, desc, key }: ToggleSpec) => ({
      name,
      desc,
      control: { type: "toggle" as const, key },
    });

    return [
      { type: "group", heading: "Features", items: FEATURE_TOGGLES.map(toggle) },
      {
        type: "group",
        heading: "About",
        items: [
          { name: ABOUT.name, desc: ABOUT.desc, action: () => this.openIcanwrite() },
          toggle(LINKS_TOGGLE),
        ],
      },
    ];
  }

  getControlValue(key: string): unknown {
    return isToggleKey(key) ? this.plugin.settings[key] : undefined;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (isToggleKey(key) && typeof value === "boolean") {
      await this.setToggle(key, value);
    }
  }

  // Obsidian before 1.13 (minAppVersion is 1.7.2).
  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("grab-a-prompt-settings");

    new Setting(containerEl).setName("Features").setHeading();
    for (const spec of FEATURE_TOGGLES) {
      this.addToggle(containerEl, spec);
    }

    new Setting(containerEl).setName("About").setHeading();
    new Setting(containerEl)
      .setName(ABOUT.name)
      .setDesc(ABOUT.desc)
      .addButton((button) =>
        button
          .setButtonText("Visit icanwrite")
          .onClick(() => this.openIcanwrite()),
      );
    this.addToggle(containerEl, LINKS_TOGGLE);
  }

  private addToggle(containerEl: HTMLElement, { name, desc, key }: ToggleSpec) {
    new Setting(containerEl)
      .setName(name)
      .setDesc(desc)
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings[key])
          .onChange((value) => this.setToggle(key, value)),
      );
  }

  private async setToggle(key: ToggleKey, value: boolean): Promise<void> {
    this.plugin.settings[key] = value;
    await this.plugin.saveSettings();
    if (key === "enableSelectionTooltip") {
      this.plugin.applySelectionBubbleSetting();
    } else {
      this.plugin.refreshSidebar();
    }
  }

  private openIcanwrite() {
    window.open(icanwriteUrl("settings"));
  }
}
