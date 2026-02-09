import { PluginSettingTab, App } from "obsidian";
import type GrabAPromptPlugin from "./main";

export interface GrabAPromptSettings {
  favorites: number[];
}

export const DEFAULT_SETTINGS: GrabAPromptSettings = {
  favorites: [],
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

    containerEl.createEl("p", {
      text: "Ready-made AI prompt templates for writers — research, drafting, editing, proofing, and more.",
    });

    containerEl.createEl("p", {
      text: "Open the 'Grab a Prompt' panel in the right sidebar to see all available templates. Click any template to copy a complete prompt to your clipboard. Your current document text will be injected automatically. Paste it into ChatGPT, Claude, Gemini, or any LLM.",
    });

    containerEl.createEl("p", {
      text: "Some templates also need a specific part of your text to work. These require you to select text in the editor first — the selected text will be inserted into the prompt along with the text. Templates that need a selection are disabled until you select something.",
    });

    containerEl.createEl("p", {
      text: "Star your favorite prompts to access them quickly.",
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
  }
}
