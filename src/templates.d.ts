// Built-in templates, generated at bundle time from templates/**/*.md
// by the esbuild plugin in scripts/templates-plugin.mjs.
declare module "virtual:templates" {
	const templates: import("./types").Template[];
	export default templates;

	/** Numeric ids used by plugin 1.0.0 → current slugs, keyed by the number. */
	export const legacyIds: import("./types").LegacyIds;
}
