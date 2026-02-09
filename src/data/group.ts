import type { Template, TemplateGroup } from "../types";

export function groupTemplatesByCategory(templates: Template[]): TemplateGroup[] {
	const categoryMap = new Map<number, { category: Template["category"]; templates: Template[] }>();

	for (const template of templates) {
		if (!template.category) continue;
		const catId = template.category.id;

		if (!categoryMap.has(catId)) {
			categoryMap.set(catId, { category: template.category, templates: [] });
		}
		categoryMap.get(catId)!.templates.push(template);
	}

	return Array.from(categoryMap.values())
		.filter((g): g is TemplateGroup => g.category !== null)
		.sort((a, b) => (a.category.position ?? 0) - (b.category.position ?? 0));
}
