import { storage } from '$storage'
import { APP_CONFIG_DEFAULTS } from '$lib/types/config'
import type { AppConfigSchema, LibraryCardSize } from '$lib/types/config'

const PREFIX = 'app-config'
const keyFor = (key: AppConfigKey) => `${PREFIX}:${key}`

export type AppConfigKey = keyof AppConfigSchema

type Normalizer<K extends AppConfigKey> = (value: unknown) => AppConfigSchema[K]

function normalizeLibraryCardSize(value: unknown): LibraryCardSize {
    if (value === 'card' || value === 'poster' || value === 'graph') {
        return value as LibraryCardSize
    }
    return 'card'
}

function normalizeString(value: unknown): string {
	if (typeof value === 'string') return value
	return ''
}

const normalizers: { [K in AppConfigKey]: Normalizer<K> } = {
	libraryCardSize: normalizeLibraryCardSize,
	jellyfinUrl: normalizeString,
	jellyfinApiKey: normalizeString,
	jellyfinUserId: normalizeString,
	customProviderUrl: normalizeString,
	customProviderName: normalizeString
}

export function isAppConfigKey(value: string): value is AppConfigKey {
	return value in normalizers
}

export async function getConfigOption<K extends AppConfigKey>(key: K): Promise<AppConfigSchema[K]> {
	const raw = await storage.getItem<unknown>(keyFor(key))
	if (raw == null) return APP_CONFIG_DEFAULTS[key]
	return normalizers[key](raw)
}

export async function setConfigOption<K extends AppConfigKey>(
	key: K,
	value: unknown
): Promise<AppConfigSchema[K]> {
	const normalized = normalizers[key](value)
	await storage.setItem(keyFor(key), normalized)
	return normalized
}

export async function getAppConfig(): Promise<AppConfigSchema> {
	return {
		libraryCardSize: await getConfigOption('libraryCardSize'),
		jellyfinUrl: await getConfigOption('jellyfinUrl'),
		jellyfinApiKey: await getConfigOption('jellyfinApiKey'),
		jellyfinUserId: await getConfigOption('jellyfinUserId'),
		customProviderUrl: await getConfigOption('customProviderUrl'),
		customProviderName: await getConfigOption('customProviderName')
	}
}
