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
	const TOP_Y = 120
	const playerHeight = 44

    // Use an effective rise based on double-jump capability (approx 1.9x single jump height)
    const effectiveDoubleRise = Math.floor(caps.maxJumpHeight * 1.9)
    const maxRise = Math.max(60, Math.floor(effectiveDoubleRise * 0.9))
	const maxRunCap = Math.floor(caps.maxAirHorizontalDistance)
	const maxRunEff = Math.floor(maxRunCap * 0.7)
	const minRun = Math.max(160, Math.floor(maxRunCap * 0.3))

	const platforms: Platform[] = []
	// Base ground (id 0) with open gaps on both sides; height matches generated platforms
	const baseWidth = Math.floor(width * 0.3)
	const baseX = Math.floor((width - baseWidth) / 2)
	platforms.push(rect(baseX, baseGroundHeight, baseWidth, platformThickness, 0))

	// Center the spawn on the starting platform (player width ≈ 32)
	const spawn = { x: Math.floor(baseX + baseWidth / 2 - 16), y: baseGroundHeight - playerHeight }

	const margin = 80
	const widthMin = 120
	const widthMax = 160
	// Increase horizontal range so platforms travel farther left/right
	const moveRangeMax = Math.min(320, Math.floor(maxRunEff * 0.7))
	const speedMin = 1.0
	const speedMax = 2.2
	// Level-based speed scaling: L1=0.25x, L5=1.25x (linear between)
	const speedScale = 0.25 + (Math.max(1, Math.min(5, id)) - 1) * 0.25
	const speedMinScaled = speedMin * speedScale
	const speedMaxScaled = speedMax * speedScale

	// Anti-stacking controls
	const minDeltaX = Math.max(180, Math.floor(maxRunEff * 0.5)) // ensure noticeable x change but within reach
	const lanes = 4
	const laneSpan = (width - margin * 2) / (lanes - 1)
	let targetLane = Math.floor(rng() * lanes)
	let laneChangeIn = 4 + Math.floor(rng() * 6) // steps until next lane switch

	let pid = 1

	function makeMovingPlatform(x: number, y: number): Platform {
		const w = Math.floor(lerp(widthMin, widthMax, rng()))
		const range = Math.floor(lerp(60, moveRangeMax, rng()))
		const omega = lerp(speedMinScaled, speedMaxScaled, rng())
		const phase = lerp(0, Math.PI * 2, rng())
		return { id: pid++, x, y, w, h: platformThickness, type: 'platform', move: { baseX: x, range, angularSpeed: omega, phase } }
	}

	function clampReachableX(prevX: number, minX: number, maxX: number, candidate: number, prevRange: number, nextRange: number) {
		// A platform is reachable if during motion the horizontal bands overlap within player's reach
		// Effective reachable window: [prevX - maxRunEff - nextRange, prevX + maxRunEff + nextRange]
		const rmin = Math.max(minX, prevX - maxRunEff - nextRange)
		const rmax = Math.min(maxX, prevX + maxRunEff + nextRange)
		if (rmin > rmax) return Math.max(minX, Math.min(maxX, prevX))
		return clamp(candidate, rmin, rmax)
	}

	// First platform reachable from spawn with more spacing but guaranteed reach
    const firstRiseMin = Math.floor(maxRise * 0.6)
    const firstRise = clamp(Math.floor(lerp(maxRise * 0.7, maxRise * 0.9, rng())), firstRiseMin, Math.floor(maxRise * 0.95))

	let currentW = Math.floor(lerp(widthMin, widthMax, rng()))
	let currentRange = Math.floor(lerp(60, moveRangeMax, rng()))
	let allowedMinX = margin + currentRange
	let allowedMaxX = width - margin - currentW - currentRange
	let laneCenter = margin + targetLane * laneSpan
	let jitter = (rng() - 0.5) * Math.min(200, Math.floor(laneSpan * 0.6))
	let candidateX = laneCenter + jitter - currentW / 2
	let currentX = clampReachableX(spawn.x, allowedMinX, allowedMaxX, candidateX, 0, currentRange)
	let currentY = clamp(baseGroundHeight - firstRise, TOP_Y + 8, baseGroundHeight - 40)
	platforms.push({ id: pid, x: currentX, y: currentY, w: currentW, h: platformThickness, type: 'platform', move: { baseX: currentX, range: currentRange, angularSpeed: lerp(speedMinScaled, speedMaxScaled, rng()), phase: lerp(0, Math.PI * 2, rng()) } })
	pid++

	// Track last X to avoid stacking
	let lastX = currentX

	for (let i = 1; i < steps; i++) {
		// Enforce a controlled vertical rise window for consistent reach
        const riseMin = Math.floor(maxRise * 0.8)
        const rise = clamp(Math.floor(lerp(maxRise * 0.9, maxRise * 1.0, rng())), riseMin, Math.floor(maxRise * 1.0))

		currentW = Math.floor(lerp(widthMin, widthMax, rng()))
		currentRange = Math.floor(lerp(60, moveRangeMax, rng()))
		allowedMinX = margin + currentRange
		allowedMaxX = width - margin - currentW - currentRange

		// Lane steering
		laneChangeIn--
		if (laneChangeIn <= 0) {
			targetLane = (targetLane + (rng() < 0.5 ? -1 : 1) + lanes) % lanes
			laneChangeIn = 4 + Math.floor(rng() * 6)
		}
		laneCenter = margin + targetLane * laneSpan
		jitter = (rng() - 0.5) * Math.min(180, Math.floor(laneSpan * 0.5))
		candidateX = laneCenter + jitter - currentW / 2

		// Reachable clamp and minimum delta
		let nextX = clampReachableX(lastX, allowedMinX, allowedMaxX, candidateX, currentRange, currentRange)
		if (Math.abs(nextX - lastX) < minDeltaX) {
			const rmin = Math.max(allowedMinX, lastX - maxRunEff)
			const rmax = Math.min(allowedMaxX, lastX + maxRunEff)
			if (rmin <= rmax) {
				const preferRight = rng() < 0.5
				nextX = preferRight ? Math.min(rmax, lastX + minDeltaX) : Math.max(rmin, lastX - minDeltaX)
			}
		}

		// Additional non-overlap rule: ensure platform centers are sufficiently separated
		const lastCenter = lastX + currentW / 2 // approximate using currentW; lastW unknown until we store; use currentW as proxy
		let nextCenter = nextX + currentW / 2
		const minCenterDelta = Math.floor(currentW * 0.9) // ~width separation
		if (Math.abs(nextCenter - lastCenter) < minCenterDelta) {
			const dirSign = nextCenter >= lastCenter ? 1 : -1
			const rmin = Math.max(allowedMinX, lastX - maxRunEff)
			const rmax = Math.min(allowedMaxX, lastX + maxRunEff)
			const needed = minCenterDelta - Math.abs(nextCenter - lastCenter)
			nextX = clamp(nextX + dirSign * needed, rmin, rmax)
			nextCenter = nextX + currentW / 2
		}

		currentX = nextX
		const nextYRaw = currentY - rise
		if (nextYRaw <= TOP_Y + 8) {
			currentY = TOP_Y + 8
			platforms.push({ id: pid, x: currentX, y: currentY, w: currentW, h: platformThickness, type: 'platform', move: { baseX: currentX, range: currentRange, angularSpeed: lerp(speedMinScaled, speedMaxScaled, rng()), phase: lerp(0, Math.PI * 2, rng()) } })
			pid++
			lastX = currentX
			break // stop generating once we hit the top to avoid clustering
		}
		currentY = clamp(nextYRaw, TOP_Y + 8, baseGroundHeight - 40)

		platforms.push({ id: pid, x: currentX, y: currentY, w: currentW, h: platformThickness, type: 'platform', move: { baseX: currentX, range: currentRange, angularSpeed: lerp(speedMinScaled, speedMaxScaled, rng()), phase: lerp(0, Math.PI * 2, rng()) } })
		pid++
		lastX = currentX

		// Occasionally add a small optional side ledge within reach to encourage timing
		if (currentY > TOP_Y + 220 && rng() < 0.22) {
			const offsetRaw = (rng() < 0.5 ? -1 : 1) * clamp(Math.floor(lerp(140, 220, rng())), 120, 240)
			const lw = Math.floor(lerp(80, 120, rng()))
			const lxAllowedMin = margin + 40
			const lxAllowedMax = width - margin - lw - 40
			const lxCandidate = currentX + offsetRaw
			const lxReachMin = Math.max(lxAllowedMin, currentX - maxRunEff - Math.floor(lerp(40, 90, rng())))
			const lxReachMax = Math.min(lxAllowedMax, currentX + maxRunEff + Math.floor(lerp(40, 90, rng())))
			const lx = clamp(lxCandidate, lxReachMin, lxReachMax)
            const lyRise = clamp(Math.floor(lerp(100, 160, rng())), 100, Math.floor(maxRise * 0.85))
			const ly = clamp(currentY - lyRise, TOP_Y + 40, baseGroundHeight - 40)
			platforms.push({ id: pid, x: lx, y: ly, w: lw, h: platformThickness, type: 'platform', move: { baseX: lx, range: Math.floor(lerp(40, 90, rng())), angularSpeed: lerp(speedMinScaled, speedMaxScaled, rng()), phase: lerp(0, Math.PI * 2, rng()) } })
			pid++
		}
	}

	// Compute topmost platform for door
	const movingPlatformsOnly = platforms.filter(p => p.type === 'platform')
	const top = movingPlatformsOnly.reduce((a, b) => (b.y < a.y ? b : a))
	const doorAttach = top.id
	const doorLocalX = Math.floor(top.w / 2) - 20
	const doorX = top.x + doorLocalX
	const doorY = top.y - 80

	return {
		id,
		spawn,
		bounds: { x: 0, y: 0, w: width, h: height },
		platforms,
		collectibles: [],
		enemies: [],
		exitDoor: { x: doorX, y: doorY, w: 40, h: 80, type: 'door', targetLevelId: ((id) % 3) + 1, attachToPlatformId: doorAttach, localOffsetX: doorLocalX },
		palette: id === 1 ? { sky: '#0b1220', fog: 'rgba(168,85,247,0.10)', ground: '#1f2937' } // purple night
			: id === 2 ? { sky: '#0a0e19', fog: 'rgba(34,197,94,0.10)', ground: '#111827' } // swamp green
			: id === 3 ? { sky: '#0b0b17', fog: 'rgba(59,130,246,0.10)', ground: '#0f172a' } // cathedral blue
			: id === 4 ? { sky: '#120a05', fog: 'rgba(251,146,60,0.12)', ground: '#1a130d' } // crypt orange
			: { sky: '#140707', fog: 'rgba(239,68,68,0.12)', ground: '#1a0e0e' }, // belfry red
		title: id === 1 ? 'Grave Beginnings' : id === 2 ? 'Swampy Spire' : id === 3 ? 'Mausoleum Rise' : id === 4 ? 'Cathedral Ascent' : 'The Bloody Summit',
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

// Classic level seeds and steps (current defaults)
const CLASSIC_SEEDS = [1337, 424242, 9876, 20241, 55555]
const CLASSIC_STEPS = [35, 50, 85, 125, 166]

export function buildClassicLevels(): LevelDefinition[] {
    return [
        generateVerticalLevel(1, 1600, 9600, CLASSIC_SEEDS[0]!, CLASSIC_STEPS[0]!),
        generateVerticalLevel(2, 1600, 9600, CLASSIC_SEEDS[1]!, CLASSIC_STEPS[1]!),
        generateVerticalLevel(3, 1600, 9600, CLASSIC_SEEDS[2]!, CLASSIC_STEPS[2]!),
        generateVerticalLevel(4, 1600, 9600, CLASSIC_SEEDS[3]!, CLASSIC_STEPS[3]!),
        generateVerticalLevel(5, 1600, 9600, CLASSIC_SEEDS[4]!, CLASSIC_STEPS[4]!),
    ]
}

// Build a 5-level set from an 8-digit base seed by appending the level number (1..5)
export function buildLevelsFromBaseSeed(baseSeedStr: string): LevelDefinition[] {
    const normalized = (baseSeedStr || '').replace(/\D/g, '').padStart(8, '0').slice(0, 8)
    const levels: LevelDefinition[] = []
    for (let i = 0; i < 5; i++) {
        const id = i + 1
        const seedNum = parseInt(`${normalized}${id % 10}`, 10)
        const steps = CLASSIC_STEPS[i]!
        levels.push(generateVerticalLevel(id, 1600, 9600, seedNum, steps))
    }
    return levels
}

// Default export used by existing code paths: classic levels
export const LEVELS: LevelDefinition[] = buildClassicLevels()
