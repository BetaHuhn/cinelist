import { isEditableTarget } from '$lib/utils/keyboard'

export type WatchlistButtonHandle = {
	keyboardPressStart: () => void
	keyboardPressEnd: () => Promise<void>
	keyboardPressAbort: () => void
}

type Options = {
	getWatchlistButton: () => WatchlistButtonHandle | null
	getHasTrailer: () => boolean
	toggleTrailer: () => void
}

export function createDetailHotkeys(options: Options) {
	let holdKey: string | null = null

	function handleKeydown(e: KeyboardEvent) {
		if (e.defaultPrevented) return
		if (e.repeat) return
		if (isEditableTarget(e.target)) return

		const k = e.key.toLowerCase()
		if (k === 's' || k === 'w' || k === 'f') {
			e.preventDefault()
			if (holdKey) return
			holdKey = k
			options.getWatchlistButton()?.keyboardPressStart()
			return
		}

		if (k === 't' && options.getHasTrailer()) {
			e.preventDefault()
			options.toggleTrailer()
		}
	}

	function handleKeyup(e: KeyboardEvent) {
		if (e.defaultPrevented) return
		if (isEditableTarget(e.target)) return
		const k = e.key.toLowerCase()
		if (!holdKey || k !== holdKey) return
		e.preventDefault()
		holdKey = null
		void options.getWatchlistButton()?.keyboardPressEnd()
	}

	function handleWindowBlur() {
		holdKey = null
		options.getWatchlistButton()?.keyboardPressAbort()
	}

	return {
		handleKeydown,
		handleKeyup,
		handleWindowBlur
	}
}
