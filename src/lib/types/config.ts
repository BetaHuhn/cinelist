export type LibraryCardSize = 'card' | 'poster' | 'graph'

export interface AppConfigSchema {
	libraryCardSize: LibraryCardSize
}

export const APP_CONFIG_DEFAULTS: AppConfigSchema = {
	libraryCardSize: 'card'
}
