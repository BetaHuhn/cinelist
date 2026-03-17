export type LibraryCardSize = 'card' | 'poster' | 'graph'

export interface AppConfigSchema {
	libraryCardSize: LibraryCardSize
	jellyfinUrl: string
	jellyfinApiKey: string
	jellyfinUserId: string
}

export const APP_CONFIG_DEFAULTS: AppConfigSchema = {
	libraryCardSize: 'card',
	jellyfinUrl: '',
	jellyfinApiKey: '',
	jellyfinUserId: ''
}
