import type { LevelDefinition, Platform } from './types'
import { getMovementCaps } from './physics'

function rect(x: number, y: number, w: number, h: number, id: number): Platform {
	return { id, x, y, w, h, type: 'ground' }
}

function generateVerticalLevel(id: number, width: number, height: number, seed: number, steps: number): LevelDefinition {
	const rng = mulberry32(seed)
	const caps = getMovementCaps()
	const platformThickness = 24
	const baseGroundHeight = height - 200
	const playerHeight = 44

	const maxRise = Math.floor(caps.maxJumpHeight * 0.85)
	const maxRun = Math.floor(caps.maxAirHorizontalDistance * 0.7)
	const minRun = Math.max(160, Math.floor(caps.maxAirHorizontalDistance * 0.3))

	const platforms: Platform[] = []
	// Base ground (id 0) with open gaps on both sides (half the previous 60% -> 30%)
	const baseWidth = Math.floor(width * 0.3)
	const baseX = Math.floor((width - baseWidth) / 2)
	platforms.push(rect(baseX, baseGroundHeight, baseWidth, 80, 0))

	const spawn = { x: baseX + 40, y: baseGroundHeight - playerHeight }

	const margin = 80
	const widthMin = 120
	const widthMax = 160
	// Increase horizontal range so platforms travel farther left/right
	const moveRangeMax = Math.min(320, Math.floor(maxRun * 0.5))
	const speedMin = 1.0
	const speedMax = 2.2

	let pid = 1

	function makeMovingPlatform(x: number, y: number): Platform {
		const w = Math.floor(lerp(widthMin, widthMax, rng()))
		const range = Math.floor(lerp(80, moveRangeMax, rng()))
		const omega = lerp(speedMin, speedMax, rng())
		const phase = lerp(0, Math.PI * 2, rng())
		return { id: pid++, x, y, w, h: platformThickness, type: 'platform', move: { baseX: x, range, angularSpeed: omega, phase } }
	}

	// First platform reachable from spawn with more spacing
	const firstRun = clamp(Math.floor(lerp(minRun * 0.6, Math.min(maxRun, 300), rng())), 120, Math.min(maxRun, 300))
	const firstRiseMin = Math.floor(maxRise * 0.4)
	const firstRise = clamp(Math.floor(lerp(maxRise * 0.45, maxRise * 0.6, rng())), firstRiseMin, Math.floor(maxRise * 0.6))

	let currentW = Math.floor(lerp(widthMin, widthMax, rng()))
	let currentRange = Math.floor(lerp(80, moveRangeMax, rng()))
	let allowedMinX = margin + currentRange
	let allowedMaxX = width - margin - currentW - currentRange
	let currentX = clamp(spawn.x + firstRun, allowedMinX, allowedMaxX)
	let currentY = clamp(baseGroundHeight - firstRise, 120, baseGroundHeight - 40)
	platforms.push({ id: pid, x: currentX, y: currentY, w: currentW, h: platformThickness, type: 'platform', move: { baseX: currentX, range: currentRange, angularSpeed: lerp(speedMin, speedMax, rng()), phase: lerp(0, Math.PI * 2, rng()) } })
	pid++

	for (let i = 1; i < steps; i++) {
		const run = clamp(Math.floor(lerp(minRun, maxRun, rng())), 180, maxRun)
		// Enforce a larger minimum vertical rise between platforms
		const riseMin = Math.floor(maxRise * 0.65)
		const rise = clamp(Math.floor(lerp(maxRise * 0.7, maxRise, rng())), riseMin, maxRise)
		const dir = rng() < 0.5 ? -1 : 1

		currentW = Math.floor(lerp(widthMin, widthMax, rng()))
		currentRange = Math.floor(lerp(80, moveRangeMax, rng()))
		allowedMinX = margin + currentRange
		allowedMaxX = width - margin - currentW - currentRange
		currentX = clamp(currentX + dir * run, allowedMinX, allowedMaxX)
		currentY = clamp(currentY - rise, 120, baseGroundHeight - 40)

		platforms.push({ id: pid, x: currentX, y: currentY, w: currentW, h: platformThickness, type: 'platform', move: { baseX: currentX, range: currentRange, angularSpeed: lerp(speedMin, speedMax, rng()), phase: lerp(0, Math.PI * 2, rng()) } })
		pid++
	}

	// Compute topmost platform for door
	const movingPlatformsOnly = platforms.filter(p => p.type === 'platform')
	const top = movingPlatformsOnly.reduce((a, b) => (b.y < a.y ? b : a))
	const doorAttach = top.id
	const doorLocalX = Math.floor(top.w / 2) - 20
	const doorX = top.x + doorLocalX
	const doorY = top.y - 80

	const len = platforms.length
	const idxA = clamp(Math.floor(len * 0.3), 1, len - 1)
	const idxB = clamp(Math.floor(len * 0.7), 1, len - 1)
	const pA = platforms[idxA]!
	const pB = platforms[idxB]!

	return {
		id,
		spawn,
		bounds: { x: 0, y: 0, w: width, h: height },
		platforms,
		collectibles: [
			{ x: pA.x + 40, y: pA.y - 40, w: 16, h: 16, type: 'lantern', attachToPlatformId: pA.id, localOffsetX: 40 },
			{ x: pB.x + 60, y: pB.y - 40, w: 16, h: 16, type: 'key', attachToPlatformId: pB.id, localOffsetX: 60 },
		],
		enemies: [],
		exitDoor: { x: doorX, y: doorY, w: 40, h: 80, type: 'door', targetLevelId: ((id) % 3) + 1, attachToPlatformId: doorAttach, localOffsetX: doorLocalX },
		palette: id === 1 ? { sky: '#0b1220', fog: 'rgba(124,58,237,0.08)', ground: '#1f2937' }
			: id === 2 ? { sky: '#0a0e19', fog: 'rgba(34,197,94,0.06)', ground: '#111827' }
			: id === 3 ? { sky: '#0b0b17', fog: 'rgba(59,130,246,0.06)', ground: '#0f172a' }
			: id === 4 ? { sky: '#0a0c16', fog: 'rgba(16,185,129,0.06)', ground: '#0f172a' }
			: { sky: '#0a0b12', fog: 'rgba(251,191,36,0.06)', ground: '#111827' },
		title: id === 1 ? 'Grave Climb' : id === 2 ? 'Swamp Spire' : id === 3 ? 'Cathedral Ascent' : id === 4 ? 'Crypt Rise' : 'Belfry Summit',
		visualSeed: seed,
	}
}

function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)) }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function mulberry32(a: number) {
	return function() {
		a |= 0; a = a + 0x6D2B79F5 | 0;
		let t = Math.imul(a ^ a >>> 15, 1 | a)
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
		return ((t ^ t >>> 14) >>> 0) / 4294967296
	}
}

export const LEVELS: LevelDefinition[] = [
	generateVerticalLevel(1, 1600, 9600, 1337, 36),
	generateVerticalLevel(2, 1600, 9600, 4242, 42),
	generateVerticalLevel(3, 1600, 9600, 9876, 45),
	generateVerticalLevel(4, 1600, 9600, 20241, 48),
	generateVerticalLevel(5, 1600, 9600, 55555, 54),
]
