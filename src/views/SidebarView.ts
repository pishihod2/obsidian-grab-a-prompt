import {
  ItemView,
  WorkspaceLeaf,
  Notice,
  type EventRef,
} from "obsidian";
import type GrabAPromptPlugin from "../main";
import type { Template, TemplateGroup } from "../types";
import { USER_TEMPLATE_CATEGORY } from "../types";
import { templates } from "../data/templates";
import { groupTemplatesByCategory, getAllTemplates } from "../data/group";
import { assemblePrompt, assembleQuickPrompt, canCopy } from "../prompt/assemble";
import { matchesFilter, getActiveMarkdownView } from "../utils";
import { TemplateEditorModal } from "../modals/TemplateEditorModal";
import { ConfirmModal } from "../modals/ConfirmModal";

export const VIEW_TYPE = "grab-a-prompt-sidebar";

export class SidebarView extends ItemView {
  plugin: GrabAPromptPlugin;
  private allTemplates: Template[];
  private groups: TemplateGroup[];
  private selectedTemplate: Template | null = null;
  private currentFilter = "";
  private selectionEventRefs: EventRef[] = [];
  private selectionChangeDomHandler: (() => void) | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: GrabAPromptPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.allTemplates = getAllTemplates(
      templates,
      this.plugin.settings.userTemplates,
      this.plugin.settings.showBuiltInTemplates,
    );
    this.groups = groupTemplatesByCategory(this.allTemplates);
  }

  refreshTemplates() {
    this.allTemplates = getAllTemplates(
      templates,
      this.plugin.settings.userTemplates,
      this.plugin.settings.showBuiltInTemplates,
    );
    this.groups = groupTemplatesByCategory(this.allTemplates);
    if (this.selectedTemplate) {
      // If we're on a detail view, check if the template still exists
      const stillExists = this.allTemplates.find(
        (t) => t.id === this.selectedTemplate!.id,
      );
      if (stillExists) {
        this.renderDetail(stillExists);
      } else {
        this.renderList();
      }
    } else {
      this.renderList();
    }
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Grab a prompt";
  }

  getIcon(): string {
    return "layout-grid";
  }

  onOpen(): Promise<void> {
    this.initCollapsedCategories();
    this.renderList();
    return Promise.resolve();
  }

  private initCollapsedCategories() {
    // On first load (no saved state), collapse everything except
    // "my-templates" and the first built-in category.
    const collapsed = this.plugin.settings.collapsedCategories;
    if (collapsed.length > 0) return;

    const builtInGroups = this.groups.filter(
      (g) => g.category.id !== USER_TEMPLATE_CATEGORY.id,
    );

    // Collapse favorites and all built-in groups after the first one
    const toCollapse: string[] = ["favorites"];
    for (let i = 1; i < builtInGroups.length; i++) {
      toCollapse.push(`cat-${builtInGroups[i].category.id}`);
    }

    if (toCollapse.length > 0) {
      collapsed.push(...toCollapse);
      void this.plugin.saveSettings();
    }
  }

  onClose(): Promise<void> {
    this.unregisterSelectionListener();
    return Promise.resolve();
  }

  private getEditor() {
    return getActiveMarkdownView(this.app)?.editor ?? null;
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
    this.currentFilter = filter;

    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass("grab-a-prompt-container");

    // Quick Prompt input
    if (this.plugin.settings.enableQuickPrompt) {
      this.renderQuickPrompt(container);
    }

    // Search input
    const searchContainer = container.createDiv({
      cls: "grab-a-prompt-search",
    });
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
    const listContainer = container.createDiv({ cls: "grab-a-prompt-list" });
    const focusTextItems: HTMLElement[] = [];

    this.renderFavoritesSection(listContainer, lowerFilter, focusTextItems);
    this.renderMyTemplatesSection(listContainer, lowerFilter, focusTextItems);
    this.renderCategoryGroups(listContainer, lowerFilter, focusTextItems);

    // Update disabled state for hasFocusText items
    if (focusTextItems.length > 0) {
      const updateDisabledStates = () => {
        const editor = this.getEditor();
        const hasSelection = !!editor?.getSelection()?.trim();
        for (const el of focusTextItems) {
          el.toggleClass("grab-a-prompt-item-disabled", !hasSelection);
        }
      };
      updateDisabledStates();
      this.registerSelectionListener(updateDisabledStates);
    }

    // Focus search input if there's already a filter
    if (filter) {
      searchInput.focus();
      searchInput.setSelectionRange(filter.length, filter.length);
    }
  }

  private renderFavoritesSection(
    listContainer: HTMLElement,
    lowerFilter: string,
    focusTextItems: HTMLElement[],
  ) {
    const favoriteTemplates = this.allTemplates.filter(
      (t) => this.isFavorite(t) && matchesFilter(t, lowerFilter),
    );

    if (favoriteTemplates.length === 0) return;

    const categoryKey = "favorites";
    const favCategoryEl = listContainer.createDiv({
      cls: "grab-a-prompt-category",
    });
    const collapsed = this.isCategoryCollapsed(categoryKey);
    const favHeader = favCategoryEl.createDiv({
      cls: "grab-a-prompt-category-header grab-a-prompt-category-header-clickable",
    });
    favHeader.createSpan({
      cls: `grab-a-prompt-category-chevron${collapsed ? " grab-a-prompt-category-chevron-collapsed" : ""}`,
      text: "\u203A",
    });
    favHeader.createSpan({
      cls: "grab-a-prompt-category-symbol grab-a-prompt-fav-symbol",
      text: "\u2605",
    });
    favHeader.createSpan({
      cls: "grab-a-prompt-category-name",
      text: "Favorites",
    });
    favHeader.addEventListener("click", () => {
      void this.toggleCategoryCollapsed(categoryKey);
      this.renderList(this.currentFilter);
    });

    if (!collapsed) {
      for (const template of favoriteTemplates) {
        this.renderTemplateItem(favCategoryEl, template, focusTextItems);
      }
    }
  }

  private isCategoryCollapsed(key: string): boolean {
    if (this.currentFilter) return false;
    return this.plugin.settings.collapsedCategories.includes(key);
  }

  private async toggleCategoryCollapsed(key: string) {
    const arr = this.plugin.settings.collapsedCategories;
    const idx = arr.indexOf(key);
    if (idx >= 0) {
      arr.splice(idx, 1);
    } else {
      arr.push(key);
    }
    await this.plugin.saveSettings();
  }

  private renderSectionHeader(
    parent: HTMLElement,
    name: string,
    categoryKey: string,
  ): HTMLElement {
    const collapsed = this.isCategoryCollapsed(categoryKey);
    const header = parent.createDiv({ cls: "grab-a-prompt-category-header grab-a-prompt-category-header-clickable" });
    header.createSpan({
      cls: `grab-a-prompt-category-chevron${collapsed ? " grab-a-prompt-category-chevron-collapsed" : ""}`,
      text: "\u203A",
    });
    header.createSpan({ cls: "grab-a-prompt-category-name", text: name });

    header.addEventListener("click", () => {
      void this.toggleCategoryCollapsed(categoryKey);
      this.renderList(this.currentFilter);
    });

    return header;
  }

  private renderMyTemplatesSection(
    listContainer: HTMLElement,
    lowerFilter: string,
    focusTextItems: HTMLElement[],
  ) {
    if (!this.plugin.settings.enableMyTemplates) return;

    const myTemplatesGroup = this.groups.find(
      (g) => g.category.id === USER_TEMPLATE_CATEGORY.id,
    );
    const myMatchingTemplates = (myTemplatesGroup?.templates ?? []).filter(
      (t) => matchesFilter(t, lowerFilter),
    );

    // Show the section if there are templates or no filter is active
    if (myMatchingTemplates.length === 0 && lowerFilter) return;

    const categoryKey = "my-templates";
    const categoryEl = listContainer.createDiv({
      cls: "grab-a-prompt-category",
    });
    const header = this.renderSectionHeader(categoryEl, "My templates", categoryKey);

    const newBtn = header.createEl("button", {
      cls: "grab-a-prompt-new-template-btn",
      attr: { "aria-label": "Create new template" },
      text: "+",
    });
    newBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      new TemplateEditorModal(this.app, this.plugin).open();
    });

    if (!this.isCategoryCollapsed(categoryKey)) {
      for (const template of myMatchingTemplates) {
        this.renderTemplateItem(categoryEl, template, focusTextItems);
      }
    }
  }

  private renderCategoryGroups(
    listContainer: HTMLElement,
    lowerFilter: string,
    focusTextItems: HTMLElement[],
  ) {
    for (const group of this.groups) {
      if (group.category.id === USER_TEMPLATE_CATEGORY.id) continue;

      const matchingTemplates = group.templates.filter(
        (t) => matchesFilter(t, lowerFilter),
      );
      if (matchingTemplates.length === 0) continue;

      const categoryKey = `cat-${group.category.id}`;
      const categoryEl = listContainer.createDiv({
        cls: "grab-a-prompt-category",
      });
      this.renderSectionHeader(categoryEl, group.category.name ?? "", categoryKey);

      if (!this.isCategoryCollapsed(categoryKey)) {
        if (group.category.subheader) {
          categoryEl.createDiv({
            cls: "grab-a-prompt-category-subheader",
            text: group.category.subheader,
          });
        }

        for (const template of matchingTemplates) {
          this.renderTemplateItem(categoryEl, template, focusTextItems);
        }
      }
    }
  }

  private renderQuickPrompt(container: HTMLElement) {
    const section = container.createDiv({ cls: "grab-a-prompt-quick-prompt" });

    section.createDiv({
      cls: "grab-a-prompt-quick-prompt-label",
      text: "Quick prompt",
    });

    const input = section.createEl("textarea", {
      cls: "grab-a-prompt-quick-prompt-input",
      attr: {
        placeholder:
          "Type a prompt and press enter to copy to clipboard (your full note will be added automatically)",
        rows: "3",
      },
    });

    const handleSend = async () => {
      const userInput = input.value.trim();
      if (!userInput) {
        new Notice("Type a prompt first");
        return;
      }

      const editor = this.getEditor();
      if (!editor) {
        new Notice("No active editor \u2014 open a note first");
        return;
      }

      const doc = editor.getValue();
      const assembled = assembleQuickPrompt(doc, userInput);
      await navigator.clipboard.writeText(assembled);

      new Notice("Prompt copied to clipboard");
    };

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    });
  }

  private renderTemplateItem(
    parentEl: HTMLElement,
    template: Template,
    focusTextItems: HTMLElement[],
  ) {
    const itemEl = parentEl.createDiv({ cls: "grab-a-prompt-item" });

    itemEl.createDiv({
      cls: "grab-a-prompt-item-name",
      text: template.name ?? "",
    });
    itemEl.createDiv({
      cls: "grab-a-prompt-item-desc",
      text: template.shortDescription ?? "",
    });

    // Favorite star — visible on hover (or always if favorited)
    this.createStarButton(
      itemEl, template,
      "grab-a-prompt-item-star-btn", "grab-a-prompt-item-star-active",
      { afterToggle: () => this.renderList() },
    );

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
      focusTextItems.push(itemEl);
    }

    // Click = copy prompt
    itemEl.addEventListener("click", () => {
      void this.handleItemCopy(template);
    });
  }

  private async handleItemCopy(template: Template) {
    const editor = this.getEditor();
    if (!editor) {
      new Notice("No active editor \u2014 open a note first");
      return;
    }

    if (!canCopy(template, editor.getSelection() ?? "")) {
      new Notice(
        "Select text in your editor first \u2014 this template needs a selection",
      );
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
      text: "\u2190 back",
    });
    backBtn.addEventListener("click", () => {
      this.renderList();
    });

    // Template name + favorite toggle
    const nameRow = container.createDiv({
      cls: "grab-a-prompt-detail-name-row",
    });
    nameRow.createSpan({
      cls: "grab-a-prompt-detail-name",
      text: template.name ?? "",
    });
    this.createStarButton(
      nameRow, template,
      "grab-a-prompt-detail-star-btn", "grab-a-prompt-detail-star-active",
    );

    // Edit/delete buttons for user templates
    if (typeof template.id === "string") {
      const actionsRow = container.createDiv({
        cls: "grab-a-prompt-detail-actions-row",
      });

      const detailEditBtn = actionsRow.createEl("button", {
        cls: "grab-a-prompt-detail-action-btn",
        attr: { "aria-label": "Edit template" },
        text: "\u270E edit",
      });
      detailEditBtn.addEventListener("click", () => {
        const ut = this.plugin.settings.userTemplates.find(
          (t) => t.id === template.id,
        );
        if (ut) new TemplateEditorModal(this.app, this.plugin, ut).open();
      });

      const detailDeleteBtn = actionsRow.createEl("button", {
        cls: "grab-a-prompt-detail-action-btn grab-a-prompt-detail-delete-btn",
        attr: { "aria-label": "Delete template" },
        text: "\u2715 delete",
      });
      detailDeleteBtn.addEventListener("click", () => {
        new ConfirmModal(
          this.app,
          "Delete this template?",
          () => { void this.plugin.deleteUserTemplate(template.id as string); },
        ).open();
      });
    }

    // Short description
    if (template.shortDescription) {
      container.createDiv({
        cls: "grab-a-prompt-detail-desc",
        text: template.shortDescription,
      });
    }

    // Prompt preview
    container.createDiv({
      cls: "grab-a-prompt-prompt-preview",
      text: template.prompt ?? "",
    });

    // Hint for hasFocusText templates
    const hintEl = container.createDiv({ cls: "grab-a-prompt-hint" });

    // Copy button
    const copyBtn = container.createEl("button", {
      cls: "grab-a-prompt-copy-btn",
      text: "Copy prompt + text to clipboard",
    });

    const updateCopyState = () => {
      const editor = this.getEditor();
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

    copyBtn.addEventListener("click", () => {
      const editor = this.getEditor();
      if (!editor) {
        new Notice("No active editor \u2014 open a note first");
        return;
      }

      const assembled = assemblePrompt(template, editor);
      void navigator.clipboard.writeText(assembled).then(() => {
        copyBtn.setText("Copied!");
        setTimeout(() => {
          copyBtn.setText("Copy prompt + text to clipboard");
        }, 3000);

        new Notice("Prompt copied to clipboard");
      });
    });
  }

  /**
   * Creates a favorite star toggle button. Used in both list items and detail view.
   * Pass `opts.afterToggle` for side effects after toggling (e.g. re-render list).
   */
  private createStarButton(
    parent: HTMLElement,
    template: Template,
    btnCls: string,
    activeCls: string,
    opts?: { afterToggle?: () => void },
  ): HTMLElement {
    const isFav = this.isFavorite(template);
    const btn = parent.createEl("button", {
      cls: btnCls,
      attr: { "aria-label": "Toggle favorite" },
    });
    btn.setText(isFav ? "\u2605" : "\u2606");
    if (isFav) btn.addClass(activeCls);

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      void this.toggleFavorite(template).then(() => {
        const nowFav = this.isFavorite(template);
        btn.setText(nowFav ? "\u2605" : "\u2606");
        btn.toggleClass(activeCls, nowFav);
        opts?.afterToggle?.();
      });
    });

    return btn;
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
      activeWindow.document.removeEventListener(
        "selectionchange",
        this.selectionChangeDomHandler,
      );
      this.selectionChangeDomHandler = null;
    }
  }
}
