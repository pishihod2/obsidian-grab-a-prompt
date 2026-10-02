export interface Category {
	id: string;
	name: string | null;
	subheader: string | null;
	position: number | null;
}

export interface Template {
	id: string;
	name: string | null;
	prompt: string | null;
	shortDescription: string | null;
	hasFocusText: boolean;
	icon: string | null;
	category: Category | null;
}

export interface TemplateGroup {
	category: Category;
	templates: Template[];
}

export interface UserTemplate {
	id: string;
	name: string;
	prompt: string;
	shortDescription: string;
	hasFocusText: boolean;
}

export interface LegacyIds {
	templates: Record<string, string>;
	categories: Record<string, string>;
}

export const USER_TEMPLATE_CATEGORY: Category = {
	id: "user",
	name: "My templates",
	subheader: null,
	position: -1,
};
