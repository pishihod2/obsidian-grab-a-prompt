import type { Template, TemplateGroup, UserTemplate } from "../types";
import { USER_TEMPLATE_CATEGORY } from "../types";

export function toTemplate(ut: UserTemplate): Template {
	return {
		id: ut.id,
		name: ut.name,
		prompt: ut.prompt,
		shortDescription: ut.shortDescription,
		hasFocusText: ut.hasFocusText,
		icon: null,
		category: USER_TEMPLATE_CATEGORY,
	};
}

export function getAllTemplates(
	builtIn: Template[],
	userTemplates: UserTemplate[],
	showBuiltIn = true,
): Template[] {
	const converted = userTemplates.map(toTemplate);
	return showBuiltIn ? [...converted, ...builtIn] : converted;
}

export function groupTemplatesByCategory(templates: Template[]): TemplateGroup[] {
	const categoryMap = new Map<number, TemplateGroup>();

	for (const template of templates) {
		if (!template.category) continue;
		const catId = template.category.id;

		if (!categoryMap.has(catId)) {
			categoryMap.set(catId, { category: template.category, templates: [] });
		}
		categoryMap.get(catId)!.templates.push(template);
	}

	return Array.from(categoryMap.values())
		.sort((a, b) => (a.category.position ?? 0) - (b.category.position ?? 0));
}
