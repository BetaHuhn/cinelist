export function isEditableTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false
	if (target.isContentEditable) return true

	const tag = target.tagName
	if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true

	// Covers custom editable widgets.
	const role = target.getAttribute('role')
	if (role === 'textbox' || role === 'searchbox') return true

	return false
}
