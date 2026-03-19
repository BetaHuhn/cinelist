/**
 * Builds a provider search URL from a URL template string.
 *
 * Supported placeholders:
 *   {NAME}       - title, URL-encoded
 *   {YEAR}       - 4-digit release year
 *   {NAME_KEBAB} - title in kebab-case (lowercase, non-alphanumeric chars → hyphens)
 *   {NAME_CAMEL} - title in camelCase
 */
export function buildProviderUrl(template: string, title: string, releaseDate: string): string {
	const year = releaseDate && releaseDate.length >= 4 ? releaseDate.slice(0, 4) : ''

	const kebab = title
		.toLowerCase()
		.replace(/['\u2018\u2019\u201B]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')

	const camel = title
		.replace(/['\u2018\u2019\u201B]/g, '')
		.replace(/[^a-zA-Z0-9]+(.)/g, (_, char: string) => char.toUpperCase())
		.replace(/^[A-Z]/, c => c.toLowerCase())
		.replace(/[^a-zA-Z0-9]/g, '')

	return template
		.replace(/\{NAME_KEBAB\}/g, kebab)
		.replace(/\{NAME_CAMEL\}/g, camel)
		.replace(/\{NAME\}/g, encodeURIComponent(title))
		.replace(/\{YEAR\}/g, year)
}
