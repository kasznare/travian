import { describe, expect, it } from 'vitest'
import {
  advanceGame,
  createNewGame,
  getConquestPreview,
  getExpansionStatus,
  getHumanPlayer,
  getMarketplaceStatus,
  issueCommand,
  recallCommand,
  shipResources,
  type GameState,
  type Village,
} from '../src/game/engine'
import {
  BUILDING_METADATA,
  COMMANDER_BY_TRIBE,
  SETTLER_BY_TRIBE,
  UNIT_DEFINITIONS,
  type ResourceStock,
} from '../src/game/rules'

function stock(wood: number, clay: number, iron: number, crop: number): ResourceStock {
  return { wood, clay, iron, crop }
}

function createGame(aiCount = 0): GameState {
  return createNewGame({
    playerName: 'Tester',
    tribe: 'romans',
    aiCount,
    seed: 424242,
  })
}

function getCapitalState(state: GameState) {
  const human = getHumanPlayer(state)
  const capital = state.villages[human.villageIds[0]]
  return { human, capital }
}

function disableAi(state: GameState): void {
  Object.values(state.players).forEach((player) => {
    if (!player.isHuman) {
      player.nextAiPlanAt = Number.MAX_SAFE_INTEGER
    }
  })
}

function findNearestOpenTile(state: GameState, village: Village, maxDistance = 3) {
  const tile = Object.values(state.tiles)
    .filter((entry) => !entry.villageId)
    .sort(
      (left, right) =>
        Math.hypot(left.x - village.x, left.y - village.y) - Math.hypot(right.x - village.x, right.y - village.y),
    )
    .find((entry) => Math.hypot(entry.x - village.x, entry.y - village.y) <= maxDistance)

  if (!tile) {
    throw new Error(`No open tile found near ${village.name}`)
  }

  return tile
}

function setCenterBuilding(village: Village, gid: number, level: number): void {
  const slot =
    village.centerSlots.find((entry) => entry.buildingGid === gid) ??
    village.centerSlots.find((entry) => entry.buildingGid === null)

  if (!slot) {
    throw new Error(`No slot available for ${BUILDING_METADATA[gid]?.name ?? gid}`)
  }

  slot.buildingGid = gid
  slot.level = level
}

function emptyUnits(): Record<string, number> {
  return Object.fromEntries(Object.keys(UNIT_DEFINITIONS).map((unitId) => [unitId, 0]))
}

function addOwnedVillage(state: GameState, tileId: string, name: string): Village {
  const { human, capital } = getCapitalState(state)
  const tile = state.tiles[tileId]
  if (!tile) {
    throw new Error(`Missing tile ${tileId}`)
  }

  const villageId = `test-village-${state.nextId++}`
  const village = structuredClone(capital)
  tile.villageId = villageId
  village.id = villageId
  village.name = name
  village.tileId = tile.id
  village.x = tile.x
  village.y = tile.y
  village.isCapital = false
  village.loyalty = 100
  village.expansionSlotsUsed = 0
  village.patternIndex = tile.patternIndex
  village.resources = stock(0, 0, 0, 0)
  village.units = emptyUnits()
  village.buildQueues = { field: null, center: null, shared: null }
  village.trainingQueues = { barracks: null, stable: null, workshop: null, residence: null, rally: null }

  state.villages[villageId] = village
  human.villageIds.push(villageId)
  return village
}

function relocateEnemyVillageNearHuman(state: GameState): Village {
  disableAi(state)
  const { capital } = getCapitalState(state)
  const enemy = Object.values(state.players).find((player) => !player.isHuman)
  if (!enemy) {
    throw new Error('Expected an AI player')
  }

  const village = state.villages[enemy.villageIds[0]]
  state.tiles[village.tileId].villageId = null

  const tile = findNearestOpenTile(state, capital, 3)
  tile.villageId = village.id
  village.tileId = tile.id
  village.x = tile.x
  village.y = tile.y
  village.name = 'Rival Hold'
  village.isCapital = false
  village.loyalty = 20
  village.resources = stock(0, 0, 0, 0)
  village.units = emptyUnits()
  village.buildQueues = { field: null, center: null, shared: null }
  village.trainingQueues = { barracks: null, stable: null, workshop: null, residence: null, rally: null }
  village.centerSlots.forEach((slot) => {
    if (slot.buildingGid === 25 || slot.buildingGid === 26 || slot.buildingGid === 31 || slot.buildingGid === 32 || slot.buildingGid === 33) {
      slot.buildingGid = null
      slot.level = 0
    }
  })

  return village
}

describe('engine simulation', () => {
  it('advances economy and culture over time', () => {
    const game = createGame()
    const { human, capital } = getCapitalState(game)

    const next = advanceGame(game, 3600)
    const nextCapital = next.villages[capital.id]
    const nextHuman = next.players[human.id]

    expect(nextCapital.resources.wood).toBeGreaterThan(capital.resources.wood)
    expect(nextCapital.resources.clay).toBeGreaterThan(capital.resources.clay)
    expect(nextCapital.resources.iron).toBeGreaterThan(capital.resources.iron)
    expect(nextHuman.culturePoints).toBeGreaterThan(0)
  })

  it('founds a new village when settlers, CP, and resources are available', () => {
    const game = createGame()
    const { human, capital } = getCapitalState(game)
    const settlerId = SETTLER_BY_TRIBE[capital.tribe]
    const targetTile = findNearestOpenTile(game, capital, 2)

    human.culturePoints = 5000
    setCenterBuilding(capital, 25, 10)
    capital.resources = stock(2000, 2000, 2000, 2000)
    capital.units[settlerId] = 3

    const outbound = issueCommand(game, capital.id, targetTile.id, { [settlerId]: 3 }, 'settle')
    const settled = advanceGame(outbound, 5000)
    const settledHuman = getHumanPlayer(settled)

    expect(settledHuman.villageIds).toHaveLength(2)
    expect(settled.tiles[targetTile.id].villageId).toBeTruthy()
    expect(settled.villages[capital.id].expansionSlotsUsed).toBe(1)
  })

  it('ships resources between owned villages and returns merchants home', () => {
    const game = createGame()
    const { capital } = getCapitalState(game)
    const targetVillage = addOwnedVillage(game, findNearestOpenTile(game, capital, 2).id, 'Village 2')

    setCenterBuilding(capital, 17, 5)
    capital.resources = stock(2000, 1500, 900, 800)

    expect(getMarketplaceStatus(game, capital.id)).toMatchObject({
      total: 5,
      available: 5,
      capacityPerMerchant: 500,
    })

    const outbound = shipResources(game, capital.id, targetVillage.tileId, stock(400, 300, 200, 100))

    expect(outbound.villages[capital.id].resources).toMatchObject(stock(1600, 1200, 700, 700))
    expect(Object.keys(outbound.commands)).toHaveLength(1)
    expect(getMarketplaceStatus(outbound, capital.id).available).toBe(3)

    const returned = advanceGame(outbound, 4000)

    expect(returned.villages[targetVillage.id].resources.wood).toBeGreaterThanOrEqual(400)
    expect(returned.villages[targetVillage.id].resources.clay).toBeGreaterThanOrEqual(300)
    expect(returned.villages[targetVillage.id].resources.iron).toBeGreaterThanOrEqual(200)
    expect(returned.villages[targetVillage.id].resources.crop).toBeGreaterThanOrEqual(100)
    expect(Object.keys(returned.commands)).toHaveLength(0)
    expect(getMarketplaceStatus(returned, capital.id).available).toBe(5)
  })

  it('recalls an outbound troop command before combat resolves', () => {
    const game = createGame(1)
    const { capital } = getCapitalState(game)
    const enemyVillage = relocateEnemyVillageNearHuman(game)

    capital.units.legionnaire = 20

    const outbound = issueCommand(game, capital.id, enemyVillage.tileId, { legionnaire: 20 }, 'attack')
    const outboundCommand = Object.values(outbound.commands)[0]
    expect(outboundCommand.phase).toBe('outbound')

    const halfway = Math.max(60, Math.floor((outboundCommand.arriveAt - outboundCommand.departAt) / 2))
    const midJourney = advanceGame(outbound, halfway)
    const recalled = recallCommand(midJourney, outboundCommand.id)
    const recalledCommand = recalled.commands[outboundCommand.id]

    expect(recalledCommand.phase).toBe('return')
    expect(recalledCommand.arriveAt - recalled.now).toBeGreaterThanOrEqual(60)

    const returned = advanceGame(recalled, recalledCommand.arriveAt - recalled.now + 1)

    expect(returned.villages[capital.id].units.legionnaire).toBe(20)
    expect(returned.villages[enemyVillage.id].ownerId).not.toBe(getHumanPlayer(returned).id)
    expect(returned.reports.some((report) => report.title === 'Command recalled')).toBe(true)
    expect(returned.reports.some((report) => report.title.includes('won at'))).toBe(false)
  })

  it('recalls a shipment and returns the cargo to the source village', () => {
    const game = createGame()
    const { capital } = getCapitalState(game)
    const targetVillage = addOwnedVillage(game, findNearestOpenTile(game, capital, 2).id, 'Village 2')

    setCenterBuilding(capital, 17, 5)
    capital.resources = stock(1000, 900, 800, 700)

    const outbound = shipResources(game, capital.id, targetVillage.tileId, stock(400, 300, 200, 100))
    const outboundCommand = Object.values(outbound.commands)[0]
    const halfway = Math.max(60, Math.floor((outboundCommand.arriveAt - outboundCommand.departAt) / 2))
    const midJourney = advanceGame(outbound, halfway)
    const recalled = recallCommand(midJourney, outboundCommand.id)
    const recalledCommand = recalled.commands[outboundCommand.id]
    const returned = advanceGame(recalled, recalledCommand.arriveAt - recalled.now + 1)

    expect(returned.villages[capital.id].resources.wood).toBeGreaterThanOrEqual(1000)
    expect(returned.villages[capital.id].resources.clay).toBeGreaterThanOrEqual(900)
    expect(returned.villages[targetVillage.id].resources.wood).toBeLessThan(5)
    expect(returned.villages[targetVillage.id].resources.clay).toBeLessThan(5)
    expect(returned.villages[targetVillage.id].resources.iron).toBeLessThan(5)
    expect(returned.villages[targetVillage.id].resources.crop).toBeLessThan(5)
    expect(getMarketplaceStatus(returned, capital.id).available).toBe(5)
  })

  it('blocks conquest without a free expansion slot', () => {
    const game = createGame(1)
    const { human, capital } = getCapitalState(game)
    const enemyVillage = relocateEnemyVillageNearHuman(game)
    const commanderId = COMMANDER_BY_TRIBE[capital.tribe]

    human.culturePoints = 5000
    capital.units.legionnaire = 20
    capital.units[commanderId] = 1

    const preview = getConquestPreview(game, capital.id, enemyVillage.id, {
      legionnaire: 20,
      [commanderId]: 1,
    })
    const attempted = issueCommand(
      game,
      capital.id,
      enemyVillage.tileId,
      { legionnaire: 20, [commanderId]: 1 },
      'conquer',
    )

    expect(preview.allowed).toBe(false)
    expect(preview.blockers).toContain('No free Residence or Palace expansion slot in the source village.')
    expect(Object.keys(attempted.commands)).toHaveLength(0)
    expect(attempted.villages[capital.id].units.legionnaire).toBe(20)
  })

  it('conquers a vulnerable village when a free slot exists', () => {
    const game = createGame(1)
    const { human, capital } = getCapitalState(game)
    const enemyVillage = relocateEnemyVillageNearHuman(game)
    const commanderId = COMMANDER_BY_TRIBE[capital.tribe]

    human.culturePoints = 5000
    setCenterBuilding(capital, 25, 10)
    capital.units.legionnaire = 20
    capital.units[commanderId] = 1

    const preview = getConquestPreview(game, capital.id, enemyVillage.id, {
      legionnaire: 20,
      [commanderId]: 1,
    })
    const outbound = issueCommand(
      game,
      capital.id,
      enemyVillage.tileId,
      { legionnaire: 20, [commanderId]: 1 },
      'conquer',
    )
    const conquered = advanceGame(outbound, 5000)
    const conqueredEnemyVillage = conquered.villages[enemyVillage.id]
    const conqueredHuman = getHumanPlayer(conquered)

    expect(preview.allowed).toBe(true)
    expect(conqueredEnemyVillage.ownerId).toBe(conqueredHuman.id)
    expect(conqueredEnemyVillage.loyalty).toBe(0)
    expect(conqueredEnemyVillage.units.legionnaire).toBe(20)
    expect(conqueredEnemyVillage.units[commanderId]).toBe(0)
    expect(conqueredHuman.villageIds).toContain(enemyVillage.id)
    expect(conquered.villages[capital.id].expansionSlotsUsed).toBe(1)
    expect(getExpansionStatus(conquered, capital.id).availableExpansionSlots).toBe(0)
  })
})
