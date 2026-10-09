// T118 deterministic, event-stepped invented crew. No content/save/browser reads; public production rules own all effects.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { STATS } from '../../packages/domain/src/types'
import {
  FARM_DISTRICTS, FARM_EXTRA_NODES, FARM_KITCHEN_CATALOGUE as catalogue, FARM_KITCHEN_ENERGY_ID, FARM_KITCHEN_JOB_MS,
  assignFarmWorker, buyFarmExtraNode, claimFarmJob, createFarmExtraBlock, createFarmKitchen, createFarmKitchenWorker,
  emptyFarmRecipes, farmBlockLevel, farmIngredientBlock, farmMealId, farmProcessedItemId, farmRawItemId, farmStation,
  farmWorkerProgress, legalFarmIngredients, resolveFarmInputs, spendFarmEnergy, startFarmJob,
  type FarmDistrict, type FarmInventory, type FarmResult, type FarmStationId,
} from '../../packages/domain/src/farm/kitchen'

function take<T>(result: FarmResult<T>): T { if (!result.ok) throw new Error(JSON.stringify(result.error)); return result.value }
interface Work { recipeId: string; quantity: number; district: FarmDistrict }
function mapWork(block: number, maps: number, alternate = false): Work[] {
  const scenario = catalogue.scenarios.find(s => farmIngredientBlock(s.tier) === block)!
  const rawFamily = alternate ? 'egg' : 'milk', processedFamily = alternate ? 'mayonnaise' : 'cheese'
  const jobs: Work[] = []
  const raw = (stat: (typeof STATS)[number], family: string, units: number, district: FarmDistrict) => {
    for (let i = 0; i < Math.ceil(units / 6); i++) jobs.push({ recipeId: farmRawItemId(scenario.id, family, stat), quantity: 1, district })
  }
  for (const stat of STATS) {
    raw(stat, 'vegetable', 10 * maps, 'garden')
    raw(stat, 'fruit', 9 * maps, 'orchard')
    const batches = Math.ceil(19 * maps / 6)
    raw(stat, rawFamily, batches * 6, 'barn')
    for (let i = 0; i < batches; i++) jobs.push({ recipeId: farmProcessedItemId(scenario.id, processedFamily, stat), quantity: 1, district: 'workshop' })
  }
  for (const recipe of catalogue.recipes.filter(r => r.kind === 'cooking' && r.block === block)) {
    let left = (recipe.signature === 'sun' ? 5 : STATS.includes(recipe.signature as (typeof STATS)[number]) ? 10 : 1) * maps
    while (left > 0) { const quantity = Math.min(4, left); jobs.push({ recipeId: recipe.id, quantity, district: 'kitchen' }); left -= quantity }
  }
  return jobs
}

type Crew = 'solo' | 'five' | 'thirty' | 'staggered'
interface SimOptions { crew: Crew; maps: number; checks: readonly number[]; block?: number; energy?: number; alternate?: boolean; variant?: boolean; sequential?: boolean; banquet?: boolean }
function simulate(options: SimOptions) {
  const block = options.block ?? 1, generation = 'synthetic'
  let farm = createFarmKitchen(generation), inventory: FarmInventory = { [FARM_KITCHEN_ENERGY_ID]: options.energy ?? 0 }
  let recipeStates = catalogue.blocks.map(b => emptyFarmRecipes(generation, b))
  const count = options.crew === 'solo' ? 1 : options.crew === 'five' ? 5 : 30
  const baseLevel = options.banquet ? 9 : farmBlockLevel(block)
  const workers = Array.from({ length: count }, (_, i) => createFarmKitchenWorker(generation, `synthetic-worker-${i}`, (baseLevel - 1) * 24))
  // Advanced gatherers plus genuinely fresh workshop/kitchen specialists; zero seed ingredients/milestones.
  if (options.variant) for (const [i, worker] of workers.entries()) if (i % 5 < 3) worker.totalExp += 10 * 24
  const owned = new Set(workers.map(w => w.outfitId))
  const jobs = options.sequential ? [1, 2, 3].flatMap(b => [
    ...mapWork(b, 1),
    // The first complete map ends at Lv44/94. Thirteen real old-block jobs bridge the next raw gate.
    ...Array.from({ length: b < 3 ? 13 : 0 }, () => ({ recipeId: farmRawItemId(catalogue.scenarios[0]!.id, 'vegetable', 'speed'), quantity: 1, district: 'garden' as const })),
  ]) : options.banquet ? [...STATS.flatMap(stat => [
    ...Array.from({ length: 4 }, () => ({ recipeId: farmRawItemId(catalogue.scenarios[0]!.id, 'vegetable', stat), quantity: 1, district: 'garden' as const })),
    ...Array.from({ length: 4 }, () => ({ recipeId: farmRawItemId(catalogue.scenarios[0]!.id, 'milk', stat), quantity: 1, district: 'barn' as const })),
    ...Array.from({ length: 4 }, () => ({ recipeId: farmProcessedItemId(catalogue.scenarios[0]!.id, 'cheese', stat), quantity: 1, district: 'workshop' as const })),
  ]), ...Array.from({ length: 6 }, () => ({ recipeId: farmMealId(1, 'sun'), quantity: 4, district: 'kitchen' as const }))] : mapWork(block, options.maps, options.alternate)
  if (options.variant) for (const [i, job] of jobs.entries()) {
    const recipe = catalogue.recipesById.get(job.recipeId)!
    if (recipe.scenarioId && i % 2 === 0) {
      // Recipe identity includes its variant. Only the first two registered scenarios of this block are used.
      const first = catalogue.scenarios.find(s => farmIngredientBlock(s.tier) === block)!
      const second = catalogue.scenarios.find(s => s.tier === first.tier + 1)!
      job.recipeId = job.recipeId.replace(`:${first.id}:`, `:${second.id}:`)
    }
  }
  const targets = options.sequential ? [1, 2, 3].map(b => createFarmExtraBlock(generation, 'synthetic-target', b)) :
    Array.from({ length: options.maps }, (_, i) => createFarmExtraBlock(generation, `synthetic-target-${i}`, block))
  const nodes = options.banquet ? FARM_EXTRA_NODES.filter(n => n.kind === 'sun').slice(0, 4) : FARM_EXTRA_NODES
  const available = (i: number, day: number) => options.crew !== 'staggered' || day >= Math.floor(i / 5) * 7
  const milestones: Record<string, number> = {}
  const stageJobs: Record<string, number> = {}, produced: Record<string, number> = {}, spent: Record<string, number> = {}
  let claims = 0, energyUsed = 0, firstMeal: number | null = null, firstMap: number | null = null, lastTime = 0
  let idleStationChecks = 0, idleMs = 0, readyWaitMs = 0, previousNow: number | null = null, previousDay = 0, stockBlockedChecks = 0
  const initialExp = workers.map(w => w.totalExp)
  for (let day = 0; day < 240; day++) for (const hour of options.checks) {
    const now = (day * 24 + hour) * 3600000, elapsed = (now - options.checks[0]! * 3600000) / 86400000
    lastTime = elapsed
    if (previousNow !== null) for (let i = 0; i < workers.length; i++) if (available(i, previousDay)) {
      const job = farm.stations.find(s => s.outfitId === workers[i]!.outfitId)?.job
      idleMs += job ? Math.max(0, now - Math.max(previousNow, job.readyAt)) : now - previousNow
    }
    previousNow = now; previousDay = day
    // Explicit repeated actions at this check-in only. Energy budget is finite; no work while absent.
    for (let pass = 0; pass < 100; pass++) {
      let changed = false
      for (let i = 0; i < workers.length; i++) {
        if (!available(i, day)) continue
        const worker = workers[i]!
        let stationId = farm.stations.find(s => s.outfitId === worker.outfitId)?.id
        const station = stationId ? farmStation(farm, stationId) : null
        if (station?.job && station.job.readyAt <= now) {
          readyWaitMs += now - station.job.readyAt
          const claim = take(claimFarmJob({ farm, stationId: station.id, worker, ownedOutfits: owned, recipeStates, inventory, now }))
          farm = claim.farm; inventory = claim.inventory; recipeStates = claim.recipeStates; workers[i] = claim.worker
          claims++; changed = true
          stageJobs[station.id.split('-')[0]!] = (stageJobs[station.id.split('-')[0]!] ?? 0) + 1
          const output = claim.receipt.output
          produced[output.itemId] = (produced[output.itemId] ?? 0) + output.amount
          for (const m of claim.receipt.milestones) milestones[`b${m.block}-${m.kind}`] ??= elapsed
          if (catalogue.foodsById.get(output.itemId)!.stage === 'meal') firstMeal ??= elapsed
        }
        if (stationId && farmStation(farm, stationId).job) continue
        const district = FARM_DISTRICTS[i % 5]!
        const choicesFor = (job: Work, quantity: number): Record<string, string> | null => {
          const recipe = catalogue.recipesById.get(job.recipeId)!
          const choices: Record<string, string> = {}
          for (const slot of recipe.inputs) {
            const canonicalRaw = options.banquet || STATS.includes(recipe.signature as (typeof STATS)[number]) ? 'vegetable' : 'fruit'
            const food = legalFarmIngredients(catalogue, recipe, slot).find(f =>
              (recipe.kind !== 'cooking' || slot.stage !== 'raw' || f.family === canonicalRaw) &&
              (inventory[f.id] ?? 0) >= slot.amount * quantity)
            if (!food) return null
            choices[slot.id] = food.id
          }
          return choices
        }
        let index = -1, quantity = 0, choices: Record<string, string> = {}, stockBlocked = false
        for (let j = 0; j < jobs.length; j++) {
          const job = jobs[j]!, recipe = catalogue.recipesById.get(job.recipeId)!
          if (options.crew !== 'solo' && job.district !== district) continue
          if (farmWorkerProgress(workers[i]!.totalExp).level < recipe.requiredLevel) continue
          const row = recipeStates.find(row => row.block === recipe.block)!
          if (recipe.kind === 'processing' && !row.processing || recipe.kind === 'cooking' && !row.cooking) continue
          // Deliberately partial batch only in the fragmentation probe, chosen BEFORE Start confirmation.
          for (let q = job.quantity; q >= (options.variant ? 1 : job.quantity); q--) {
            const picked = choicesFor(job, q)
            if (picked) { index = j; quantity = q; choices = picked; break }
          }
          if (index >= 0) break
          stockBlocked = true
        }
        if (index < 0) { if (pass === 0 && stockBlocked) stockBlockedChecks++; continue }
        const job = jobs[index]!
        const destination = options.crew === 'solo' ? `${job.district}-1` as FarmStationId : `${district}-${Math.floor(i / 5) + 1}` as FarmStationId
        farm = take(assignFarmWorker(farm, destination, workers[i]!.outfitId, owned))
        stationId = destination
        const start = take(startFarmJob({ farm, stationId, worker: workers[i]!, ownedOutfits: owned, recipeStates, inventory,
          now, recipeId: job.recipeId, quantity, choices }))
        farm = start.farm; inventory = start.inventory; changed = true
        for (const debit of start.debits) spent[debit.itemId] = (spent[debit.itemId] ?? 0) + debit.amount
        if (quantity === job.quantity) jobs.splice(index, 1); else job.quantity -= quantity
        while ((inventory[FARM_KITCHEN_ENERGY_ID] ?? 0) > 0 && farmStation(farm, stationId).job!.readyAt > now) {
          const energy = take(spendFarmEnergy({ farm, stationId, inventory, now }))
          farm = energy.farm; inventory = energy.inventory; energyUsed++
        }
      }
      for (let t = 0; t < targets.length; t++) for (const node of nodes) {
        const targetBlock = targets[t]!.block
        const scenarioId = catalogue.scenarios.find(s => farmIngredientBlock(s.tier) === targetBlock)!.id
        if (targets[t]!.boughtNodeIds.includes(node.id) || !(inventory[farmMealId(targetBlock, node.signature)] ?? 0)) continue
        const purchase = take(buyFarmExtraNode({ map: targets[t]!, outfitId: targets[t]!.outfitId, scenarioId, distance: 'mile',
          unlockedScenarioIds: new Set([scenarioId]), inventory, nodeId: node.id }))
        targets[t] = purchase.map; inventory = purchase.inventory
        const itemId = farmMealId(targetBlock, node.signature)
        spent[itemId] = (spent[itemId] ?? 0) + 1
        changed = true
      }
      if (targets.some(map => map.boughtNodeIds.length === nodes.length)) firstMap ??= elapsed
      if (!changed) break
      if (pass === 99) throw new Error('Check-in action bound exceeded')
    }
    idleStationChecks += workers.filter((w, i) => available(i, day) && !farm.stations.some(s => s.outfitId === w.outfitId && s.job)).length
    if (targets.every(map => map.boughtNodeIds.length === nodes.length)) {
      for (const food of catalogue.foods) if (food.stage !== 'energy') assert.equal(inventory[food.id] ?? 0, (produced[food.id] ?? 0) - (spent[food.id] ?? 0))
      assert.equal(workers.reduce((sum, w, i) => sum + w.totalExp - initialExp[i]!, 0), claims * 12)
      assert.ok(Object.values(inventory).every(n => n >= 0 && Number.isSafeInteger(n)))
      if (options.crew === 'solo' && options.maps === 1 && !options.alternate) for (const stat of STATS) {
        const scenario = catalogue.scenarios.find(s => farmIngredientBlock(s.tier) === block)!.id
        for (const [family, gathered, consumed] of [['vegetable', 12, 10], ['fruit', 12, 9], ['milk', 24, 24]] as const) {
          assert.equal(produced[farmRawItemId(scenario, family, stat)], gathered)
          assert.equal(spent[farmRawItemId(scenario, family, stat)], consumed)
        }
        assert.equal(produced[farmProcessedItemId(scenario, 'cheese', stat)], 24)
        assert.equal(spent[farmProcessedItemId(scenario, 'cheese', stat)], 19)
      }
      return { ...options, fullMapDays: elapsed, firstMeal, firstMap, milestones, claims, stageJobs, energyUsed, idleStationChecks,
        idleHours: idleMs / 3600000, readyWaitHours: readyWaitMs / 3600000, stockBlockedChecks,
        workerLevels: workers.map(w => farmWorkerProgress(w.totalExp).level),
        rawSurplus: catalogue.foods.filter(f => f.stage === 'raw').reduce((n, f) => n + (inventory[f.id] ?? 0), 0),
        processedSurplus: catalogue.foods.filter(f => f.stage === 'processed').reduce((n, f) => n + (inventory[f.id] ?? 0), 0) }
    }
  }
  throw new Error(`Unfunded pipeline after ${lastTime} days: ${JSON.stringify(options)}, remaining ${jobs.length}`)
}

const checks = [8, 20]
const results = [
  simulate({ crew: 'solo', maps: 1, checks }), simulate({ crew: 'solo', maps: 1, checks: [7, 15, 23] }),
  simulate({ crew: 'solo', maps: 1, checks: [0, 6, 12, 18] }), simulate({ crew: 'five', maps: 1, checks }),
  simulate({ crew: 'thirty', maps: 30, checks }), simulate({ crew: 'staggered', maps: 30, checks }),
  simulate({ crew: 'five', maps: 1, checks, energy: 50 }), simulate({ crew: 'solo', maps: 1, checks, alternate: true }),
  simulate({ crew: 'five', maps: 1, checks, variant: true }),
  ...[2, 3].map(block => simulate({ crew: 'solo' as const, maps: 1, checks, block })),
]
const solo = results[0]!, full = results[4]!
assert.deepEqual(solo.stageJobs, { garden: 10, orchard: 10, barn: 20, workshop: 20, kitchen: 27 })
assert.equal(solo.claims, 87); assert.ok(solo.claims <= 98)
assert.equal(solo.rawSurplus, 25); assert.equal(solo.processedSurplus, 25)
assert.deepEqual(full.stageJobs, { garden: 250, orchard: 225, barn: 475, workshop: 475, kitchen: 493 })
assert.ok(Object.values(full.stageJobs).every(n => n <= 588))
assert.equal(solo.fullMapDays, 43.5); assert.equal(results[1]!.fullMapDays, 29); assert.equal(results[2]!.fullMapDays, 21.75)

// Personal timing uses actual starts/claims, not a days/worker arithmetic shortcut.
function personalTiming(schedule: number[]) {
  const generation = 'personal', owned = new Set(['synthetic-personal'])
  let farm = take(assignFarmWorker(createFarmKitchen(generation), 'garden-1', 'synthetic-personal', owned))
  let worker = createFarmKitchenWorker(generation, 'synthetic-personal'), inventory: FarmInventory = {}
  let recipeStates = catalogue.blocks.map(b => emptyFarmRecipes(generation, b)), completions = 0, idleMs = 0
  for (let day = 0; day < 100; day++) for (const hour of schedule) {
    const now = (day * 24 + hour) * 3600000
    const job = farmStation(farm, 'garden-1').job
    if (job && job.readyAt <= now) {
      idleMs += now - job.readyAt
      const claim = take(claimFarmJob({ farm, stationId: 'garden-1', worker, ownedOutfits: owned, recipeStates, inventory, now }))
      farm = claim.farm; worker = claim.worker; inventory = claim.inventory; recipeStates = claim.recipeStates; completions++
      if (completions === 10) assert.equal(recipeStates[0]!.processing?.level, 6)
      if (completions === 16) assert.equal(recipeStates[0]!.cooking?.level, 9)
      if (completions === 98) {
        assert.equal(worker.totalExp, 1176); assert.equal(farmWorkerProgress(worker.totalExp).level, 50)
        assert.equal(inventory[farmRawItemId(catalogue.scenarios[0]!.id, 'vegetable', 'speed')], 588)
        return { checks: schedule, level50Days: (now - schedule[0]! * 3600000) / 86400000, completions, exp: worker.totalExp,
          level: farmWorkerProgress(worker.totalExp).level, idleHours: idleMs / 3600000 }
      }
    }
    if (!farmStation(farm, 'garden-1').job) {
      const start = take(startFarmJob({ farm, stationId: 'garden-1', worker, ownedOutfits: owned, recipeStates, inventory, now,
        recipeId: farmRawItemId(catalogue.scenarios[0]!.id, 'vegetable', 'speed'), quantity: 1, choices: {} }))
      farm = start.farm; inventory = start.inventory
    }
  }
  throw new Error('Personal timing did not reach Lv50')
}
const personal = [[8, 20], [7, 15, 23], [0, 6, 12, 18]].map(personalTiming)
assert.deepEqual(personal.map(p => p.level50Days), [49, 98 / 3, 24.5])
const sequential = simulate({ crew: 'solo', maps: 3, checks, sequential: true })
assert.equal(sequential.claims, 287); assert.equal(sequential.fullMapDays, 143.5); assert.deepEqual(sequential.workerLevels, [144])
const banquet = simulate({ crew: 'thirty', maps: 6, checks, banquet: true })
assert.equal(banquet.claims, 66); assert.equal(banquet.rawSurplus, 0); assert.equal(banquet.processedSurplus, 0)
assert.equal(banquet.stageJobs.kitchen, 6)
assert.deepEqual(results.map(r => r.fullMapDays), [43.5, 29, 21.75, 21.5, 49.5, 63, 21, 43.5, 15, 43.5, 43.5])
const digest = createHash('sha256').update(JSON.stringify({ results, personal, sequential, banquet })).digest('hex')
assert.equal(digest, '99fc49c3909c9ccb504789c17c0f3979e0b413a95d128c9473098c7f3b7fb144', 'Reviewed production envelope drift; update design/decision/evidence together')
if (process.argv.includes('--json')) console.log(JSON.stringify({ digest, results, personal, sequential, banquet }, null, 2))
else {
  console.log('Farm kitchen — public pure rules, empty stocks, exact batches, finite declared check-ins')
  for (const r of results) console.log(JSON.stringify(r))
  console.log('Personal level timing', JSON.stringify(personal))
  console.log('Three-block witness', JSON.stringify(sequential))
  console.log('Banquet burst (requires stock buffer)', JSON.stringify(banquet))
  console.log('Regression sha256', digest)
}
