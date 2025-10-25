export type KeyState = {
	left: boolean
	right: boolean
	jump: boolean
	reset: boolean
	level: 1 | 2 | 3 | 4 | 5 | null
}

export function createInput() {
	const state: KeyState = { left: false, right: false, jump: false, reset: false, level: null }

	function onKeyDown(e: KeyboardEvent) {
		switch (e.key) {
			case 'a':
			case 'A':
			case 'ArrowLeft': state.left = true; break
			case 'd':
			case 'D':
			case 'ArrowRight': state.right = true; break
			case 'w':
			case 'W':
			case 'ArrowUp':
			case ' ': state.jump = true; break
			case 'r':
			case 'R': state.reset = true; break
			case '1': state.level = 1; break
			case '2': state.level = 2; break
			case '3': state.level = 3; break
			case '4': state.level = 4; break
			case '5': state.level = 5; break
		}
	}

	function onKeyUp(e: KeyboardEvent) {
		switch (e.key) {
			case 'a':
			case 'A':
			case 'ArrowLeft': state.left = false; break
			case 'd':
			case 'D':
			case 'ArrowRight': state.right = false; break
			case 'w':
			case 'W':
			case 'ArrowUp':
			case ' ': state.jump = false; break
			case 'r':
			case 'R': state.reset = false; break
		}
	}

	window.addEventListener('keydown', onKeyDown)
	window.addEventListener('keyup', onKeyUp)

	return {
		state,
		dispose() {
			window.removeEventListener('keydown', onKeyDown)
			window.removeEventListener('keyup', onKeyUp)
		}
	}
}
