declare module 'node:process' {
	const process: {
		env: Record<string, string | undefined>
		argv: string[]
	}

	export default process
}
