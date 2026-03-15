export type LibraryCardSize = 'small' | 'medium'

export interface AppConfigSchema {
	libraryCardSize: LibraryCardSize
}

export const APP_CONFIG_DEFAULTS: AppConfigSchema = {
	libraryCardSize: 'small'
}
