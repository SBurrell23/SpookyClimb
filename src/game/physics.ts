import type { Player, Platform, Rect, Vec2 } from './types'

const GRAVITY = 1800 // px/s^2
const MOVE_SPEED = 260 // px/s
const JUMP_VELOCITY = 780 // px/s (increased for better reach)
const MAX_FALL_SPEED = 1200
const CUT_JUMP_GRAVITY_MULTIPLIER = 2.2

export function createPlayer(spawn: Vec2): Player {
	return {
		pos: { x: spawn.x, y: spawn.y },
		vel: { x: 0, y: 0 },
		onGround: false,
		width: 32,
		height: 44,
		facing: 1,
	}
}

export function getMovementCaps() {
	const timeUp = JUMP_VELOCITY / GRAVITY
	const airTime = timeUp * 2
	const maxJumpHeight = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY)
	const maxAirHorizontalDistance = MOVE_SPEED * airTime
	return {
		gravity: GRAVITY,
		jumpVelocity: JUMP_VELOCITY,
		moveSpeed: MOVE_SPEED,
		airTime,
		maxJumpHeight,
		maxAirHorizontalDistance,
	}
}

export function aabbIntersect(a: Rect, b: Rect) {
	return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

export type PhysicsInput = { left: boolean; right: boolean; jumpPressed: boolean; jumpHeld: boolean; coyoteAvailable?: boolean }

export function stepPlayer(player: Player, dt: number, input: PhysicsInput, solids: Platform[]) {
	// Horizontal
	let move = 0
	if (input.left) move -= 1
	if (input.right) move += 1
	player.vel.x = move * MOVE_SPEED
	if (move !== 0) player.facing = move > 0 ? 1 : -1

	// Vertical base gravity
	player.vel.y += GRAVITY * dt

	// Jump on rising edge, with optional coyote time
	if (input.jumpPressed && (player.onGround || input.coyoteAvailable)) {
		player.vel.y = -JUMP_VELOCITY
		player.onGround = false
	}

	// Cut jump height if jump is released during ascent
	if (!input.jumpHeld && player.vel.y < 0) {
		player.vel.y += GRAVITY * (CUT_JUMP_GRAVITY_MULTIPLIER - 1) * dt
	}

	if (player.vel.y > MAX_FALL_SPEED) player.vel.y = MAX_FALL_SPEED

	// Integrate X
	player.pos.x += player.vel.x * dt
	solveCollisions(player, solids, 'x')

	// Integrate Y
	player.pos.y += player.vel.y * dt
	player.onGround = false
	solveCollisions(player, solids, 'y')
}

function solveCollisions(player: Player, solids: Platform[], axis: 'x' | 'y') {
	const bbox: Rect = { x: player.pos.x, y: player.pos.y, w: player.width, h: player.height }
	for (const s of solids) {
		if (!aabbIntersect(bbox, s)) continue
		if (axis === 'x') {
			if (player.vel.x > 0) {
				player.pos.x = s.x - player.width
			} else if (player.vel.x < 0) {
				player.pos.x = s.x + s.w
			}
			player.vel.x = 0
			bbox.x = player.pos.x
		} else {
			if (player.vel.y > 0) {
				player.pos.y = s.y - player.height
				player.vel.y = 0
				player.onGround = true
			} else if (player.vel.y < 0) {
				player.pos.y = s.y + s.h
				player.vel.y = 0
			}
			bbox.y = player.pos.y
		}
	}
}
