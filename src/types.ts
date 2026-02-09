export interface Category {
	id: number;
	name: string | null;
	subheader: string | null;
	position: number | null;
}

export interface Template {
	id: number;
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
