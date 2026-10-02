// esbuild plugin: bundles templates/**/*.md as the virtual module "virtual:templates".
//
// Layout:
//   templates/categories.json        — ordered list of { slug, name, subheader, legacyId? }
//   templates/<category>/<slug>.md   — one template per file
//
// Frontmatter fields used: name, short_description, hasFocusText, icon, date, id.
// `id` (and a category's `legacyId`) are the numeric ids plugin 1.0.0 stored in
// user settings; they're exported as `legacyIds` so saved favorites can be migrated.
// The prompt is the body up to the first <!-- download --> / <!-- article -->
// marker (same files as grabaprompt.com; the rest of the body is site-only).

import { readFileSync, readdirSync, statSync } from "fs";
import { join, basename } from "path";
import { parse as parseYaml } from "yaml";

const MODULE_ID = "virtual:templates";
const NAMESPACE = "grab-a-prompt-templates";
const SECTION_MARKER = /<!--\s*(download|article)\s*-->/;
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function str(value) {
	return typeof value === "string" ? value.trim() : null;
}

export function loadTemplates(dir) {
	const errors = [];
	const categories = JSON.parse(readFileSync(join(dir, "categories.json"), "utf-8"));
	const categoryBySlug = new Map(
		categories.map((c, i) => [c.slug, { id: c.slug, name: c.name, subheader: c.subheader ?? null, position: i }]),
	);

	const legacyIds = { templates: {}, categories: {} };
	for (const c of categories) {
		if (typeof c.legacyId === "number") legacyIds.categories[c.legacyId] = c.slug;
	}

	const folders = readdirSync(dir).filter((f) => statSync(join(dir, f)).isDirectory());
	for (const folder of folders) {
		if (!categoryBySlug.has(folder)) errors.push(`templates/${folder}/: no entry in templates/categories.json`);
	}

	const entries = [];
	const files = [join(dir, "categories.json")];
	const seen = new Map();
	for (const folder of folders) {
		const category = categoryBySlug.get(folder);
		if (!category) continue;

		for (const file of readdirSync(join(dir, folder)).filter((f) => f.endsWith(".md"))) {
			const rel = `templates/${folder}/${file}`;
			files.push(join(dir, folder, file));
			const slug = basename(file, ".md");
			if (seen.has(slug)) {
				errors.push(`${rel}: duplicate slug "${slug}" (also ${seen.get(slug)})`);
				continue;
			}
			seen.set(slug, rel);

			const match = FRONTMATTER.exec(readFileSync(join(dir, folder, file), "utf-8"));
			if (!match) {
				errors.push(`${rel}: missing frontmatter`);
				continue;
			}

			let fm;
			try {
				fm = parseYaml(match[1]) ?? {};
			} catch (e) {
				errors.push(`${rel}: invalid frontmatter — ${e.message}`);
				continue;
			}

			const name = str(fm.name);
			const prompt = match[2].split(SECTION_MARKER)[0].trim();
			if (!name) errors.push(`${rel}: missing "name"`);
			if (!prompt) errors.push(`${rel}: empty prompt`);
			if (!name || !prompt) continue;

			if (typeof fm.id === "number") {
				const other = legacyIds.templates[fm.id];
				if (other) errors.push(`${rel}: duplicate id ${fm.id} (also ${other})`);
				legacyIds.templates[fm.id] = slug;
			}

			entries.push({
				date: str(fm.date) ?? "",
				template: {
					id: slug,
					name,
					prompt,
					shortDescription: str(fm.short_description),
					hasFocusText: fm.hasFocusText === true,
					icon: str(fm.icon),
					category,
				},
			});
		}
	}

	// Same order as grabaprompt.com: newest first, undated last, then by slug
	entries.sort((a, b) => {
		if (a.date !== b.date) {
			if (!a.date) return 1;
			if (!b.date) return -1;
			return a.date < b.date ? 1 : -1;
		}
		return a.template.id.localeCompare(b.template.id);
	});

	return { templates: entries.map((e) => e.template), legacyIds, folders, files, errors };
}

export function templatesPlugin(dir) {
	return {
		name: "templates",
		setup(build) {
			build.onResolve({ filter: /^virtual:templates$/ }, () => ({ path: MODULE_ID, namespace: NAMESPACE }));

			build.onLoad({ filter: /.*/, namespace: NAMESPACE }, () => {
				const { templates, legacyIds, folders, files, errors } = loadTemplates(dir);
				// Watch even on errors so `npm run dev` rebuilds once the file is fixed
				const watch = { watchDirs: [dir, ...folders.map((f) => join(dir, f))], watchFiles: files };
				if (errors.length > 0) {
					return { errors: errors.map((text) => ({ text: `Invalid template: ${text}` })), ...watch };
				}
				const contents = `export default ${JSON.stringify(templates)};\nexport const legacyIds = ${JSON.stringify(legacyIds)};\n`;
				return { contents, loader: "js", ...watch };
			});
		},
	};
}
