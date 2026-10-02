import type { LegacyIds } from "../types";

interface MigratableSettings {
	favorites: unknown[];
	collapsedCategories: string[];
}

/**
 * Plugin 1.0.0 identified built-in templates and categories by numeric ids.
 * Since 1.0.1 they're slugs. Rewrites saved favorites (number → slug) and
 * collapsed-category keys (`cat-4` → `cat-research`) in place. Unknown numeric
 * ids are dropped. Returns true if anything changed.
 */
export function migrateLegacyIds(settings: MigratableSettings, legacyIds: LegacyIds): boolean {
	let changed = false;

	const favorites: string[] = [];
	for (const fav of settings.favorites) {
		if (typeof fav === "string") {
			favorites.push(fav);
			continue;
		}
		changed = true;
		const slug = typeof fav === "number" ? legacyIds.templates[fav] : undefined;
		if (slug && !favorites.includes(slug)) favorites.push(slug);
	}

	const collapsed: string[] = [];
	for (const key of settings.collapsedCategories) {
		const match = /^cat-(\d+)$/.exec(key);
		if (!match) {
			collapsed.push(key);
			continue;
		}
		changed = true;
		const slug = legacyIds.categories[match[1]];
		if (slug) collapsed.push(`cat-${slug}`);
	}

	if (changed) {
		settings.favorites = favorites;
		settings.collapsedCategories = collapsed;
	}
	return changed;
}
