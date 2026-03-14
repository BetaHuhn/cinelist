/**
 * Storage configuration for CineList.
 *
 * By default, Deno KV is used. To switch backends, replace the driver
 * below with any unstorage-compatible driver. All drivers are listed at:
 * https://unstorage.unjs.io/drivers
 *
 * Examples:
 *
 * --- Filesystem (great for local dev without Deno) ---
 * import fsDriver from 'unstorage/drivers/fs'
 * driver: fsDriver({ base: './.data' })
 *
 * --- In-memory (ephemeral, useful for testing) ---
 * import memoryDriver from 'unstorage/drivers/memory'
 * driver: memoryDriver()
 *
 * --- Redis ---
 * import redisDriver from 'unstorage/drivers/redis'
 * driver: redisDriver({ url: 'redis://localhost:6379' })
 *
 * --- Cloudflare KV ---
 * import cloudflareKVBindingDriver from 'unstorage/drivers/cloudflare-kv-binding'
 * driver: cloudflareKVBindingDriver({ binding: 'MY_KV_NAMESPACE' })
 *
 * --- MongoDB ---
 * import mongodbDriver from 'unstorage/drivers/mongodb'
 * driver: mongodbDriver({ connectionString: 'mongodb://localhost', databaseName: 'cinelist' })
 */

import { createStorage } from 'unstorage'
import denoKvDriver from 'unstorage/drivers/deno-kv'

const DB_PATH = './.data/cinelist.kv'

export const storage = createStorage({
	driver: denoKvDriver({
		path: DB_PATH
	})
})
