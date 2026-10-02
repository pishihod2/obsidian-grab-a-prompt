const ICANWRITE_URL = "https://icanwrite.app/";

/** Where in the plugin UI a link is shown; reported as utm_content. */
export type LinkPlacement = "detail" | "footer" | "settings";

export function icanwriteUrl(placement: LinkPlacement): string {
	const params = new URLSearchParams({
		utm_source: "obsidian",
		utm_medium: "plugin",
		utm_campaign: "grab-a-prompt",
		utm_content: placement,
	});
	return `${ICANWRITE_URL}?${params.toString()}`;
}
