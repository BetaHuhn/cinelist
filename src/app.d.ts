// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			preview?: {
				mediaType: 'movie' | 'tv'
				id: number
				from: string
			}
		}
		// interface Platform {}
	}

	// Deno KV types (server-side only)
	namespace Deno {
		interface Kv {
			get<T = unknown>(key: KvKey): Promise<KvEntry<T>>
			set(key: KvKey, value: unknown): Promise<KvCommitResult>
			delete(key: KvKey): Promise<void>
			list<T = unknown>(selector: { prefix: KvKey }): AsyncIterable<KvEntry<T>>
			atomic(): AtomicOperation
		}

		interface KvEntry<T> {
			key: KvKey
			value: T
			versionstamp: string | null
		}

		interface KvCommitResult {
			ok: boolean
			versionstamp: string
		}

		interface AtomicOperation {
			check(...checks: KvEntry<unknown>[]): AtomicOperation
			set(key: KvKey, value: unknown): AtomicOperation
			delete(key: KvKey): AtomicOperation
			commit(): Promise<KvCommitResult>
		}

		type KvKey = readonly (string | number | bigint | boolean | Uint8Array)[]

		function openKv(path?: string): Promise<Kv>
	}
}

export {}
