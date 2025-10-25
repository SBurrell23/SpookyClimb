import type { EnemyPlaceholder, Rect } from './types'

export type EnemyInstance = EnemyPlaceholder & { dir: 1 | -1 }

export function instantiateEnemies(defs: EnemyPlaceholder[]): EnemyInstance[] {
	return defs.map((d, i) => ({ ...d, dir: i % 2 === 0 ? 1 : -1 }))
}

export function stepEnemies(enemies: EnemyInstance[], dt: number, solids: Rect[]) {
	// Placeholder: simple horizontal bobbing for now
	for (const e of enemies) {
		e.x += e.dir * 40 * dt
		if (Math.random() < 0.01) e.dir *= -1
	}
}

export function drawEnemies(ctx: CanvasRenderingContext2D, enemies: EnemyInstance[], time: number) {
	ctx.save()
	ctx.fillStyle = 'rgba(248,113,113,0.9)'
	for (const e of enemies) {
		const bob = Math.sin(time * 3 + e.x * 0.01) * 4
		ctx.fillRect(e.x, e.y + bob, e.w, e.h)
	}
	ctx.restore()
}
