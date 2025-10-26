export type Vec2 = { x: number; y: number }

export type Rect = { x: number; y: number; w: number; h: number }

export type Player = {
	pos: Vec2
	vel: Vec2
	onGround: boolean
	width: number
	height: number
	facing: 1 | -1
	airJumpsLeft?: number
}

export type PlatformMove = {
	baseX: number
	range: number
	angularSpeed: number
	phase: number
}

export type Platform = Rect & { id: number; type: 'ground' | 'platform'; move?: PlatformMove }

export type Collectible = Rect & { type: 'key' | 'lantern'; attachToPlatformId?: number; localOffsetX?: number }

export type EnemyPlaceholder = Rect & { kind: 'patroller' | 'jumper' }

export type Door = Rect & { type: 'door'; targetLevelId: number; attachToPlatformId?: number; localOffsetX?: number }

export type LevelDefinition = {
	id: number
	spawn: Vec2
	bounds: Rect
	platforms: Platform[]
	collectibles: Collectible[]
	enemies: EnemyPlaceholder[]
	exitDoor: Door
	palette: { sky: string; fog: string; ground: string }
	title: string
	visualSeed: number
}

export type GameDimensions = { width: number; height: number }
