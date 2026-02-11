export interface Category {
	id: number;
	name: string | null;
	subheader: string | null;
	position: number | null;
}

export interface Template {
	id: number | string;
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

export const USER_TEMPLATE_CATEGORY: Category = {
	id: -1,
	name: "My templates",
	subheader: null,
	position: -1,
};
