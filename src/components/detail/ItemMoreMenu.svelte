<script lang="ts">
  	import MoreMenu from '$components/ui/MoreMenu.svelte';
	import Eye from '$components/icons/Eye.svelte';
	import EyeOff from '$components/icons/EyeOff.svelte';
	
	import { blacklist, addToBlacklist, removeFromBlacklist } from '$lib/stores/blacklist'
	import { addToast } from '$lib/stores/ui'
	import type { MediaType } from '$lib/types/app'

	interface Props {
		id: number
		mediaType: MediaType
		title: string
		poster_path: string | null
	}

	let { id, mediaType, title, poster_path }: Props = $props()

	const blacklisted = $derived($blacklist.some(i => i.id === id && i.mediaType === mediaType))

	async function handleBlacklist() {
		// close()
		try {
			if (blacklisted) {
				await removeFromBlacklist(id, mediaType)
				addToast('Removed from hidden items', 'success')
			} else {
				await addToBlacklist({ id, mediaType, title, poster_path })
				addToast('Hidden permanently', 'success')
			}
		} catch {
			addToast('Something went wrong', 'error')
		}
	}
</script>

<MoreMenu
	className="py-3 rounded-xl"
	items={[
		{
			label: blacklisted ? 'Show again' : 'Hide permanently',
			icon: blacklisted
				? Eye
				: EyeOff,
			action: handleBlacklist
		}
	]}
/>