import type { Collectible, Player, Rect } from './types'
import { aabbIntersect } from './physics'

export function playerAABB(player: Player): Rect {
	return { x: player.pos.x, y: player.pos.y, w: player.width, h: player.height }
}

export function collectItems(player: Player, items: Collectible[]): { collected: Collectible[] } {
	const bbox = playerAABB(player)
	const collected: Collectible[] = []
	for (let i = items.length - 1; i >= 0; i--) {
		const it = items[i]
		if (!it) continue
		if (aabbIntersect(bbox, it)) {
			collected.push(it)
			items.splice(i, 1)
		}
	}
	return { collected }
}
