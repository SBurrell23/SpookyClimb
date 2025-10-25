import type { GameDimensions, Rect, Vec2 } from './types'

export function createCamera(view: GameDimensions, worldBounds: Rect) {
	const pos: Vec2 = { x: 0, y: 0 }
	function applyBounds() {
		if (pos.x < worldBounds.x) pos.x = worldBounds.x
		if (pos.y < worldBounds.y) pos.y = worldBounds.y
		const maxX = worldBounds.x + worldBounds.w - view.width
		const maxY = worldBounds.y + worldBounds.h - view.height
		if (pos.x > maxX) pos.x = maxX
		if (pos.y > maxY) pos.y = maxY
	}
	return {
		pos,
		follow(target: Vec2) {
			pos.x = target.x - view.width / 2
			pos.y = target.y - view.height / 2
			applyBounds()
		}
	}
}
