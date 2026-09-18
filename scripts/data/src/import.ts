// CLI orchestration for the private content data pipeline (docs/tasks/T001-content-data-packs.md).

import { assertRaceCourseContent, selectBaselineRaceSkills, summarizeRaceSkillCoverage } from '@racer/domain'
import { DATASET_NAMES, loadGameToraData } from './gametora'
import { normalizeCards } from './normalize/cards'
import { normalizeCourses } from './normalize/courses'
import { normalizeObjectiveFamilies } from './normalize/objectives'
import { normalizeRaces } from './normalize/races'
import { normalizeSkills } from './normalize/skills'
import { normalizeUmas } from './normalize/umas'
import { writeContentPacks } from './pack'

async function main(): Promise<void> {
  const refresh = process.argv.includes('--refresh')
  const { manifest, datasets } = await loadGameToraData({ refresh })
  const source = Object.fromEntries(DATASET_NAMES.map((name) => [name, manifest[name]!]))

  const races = normalizeRaces(datasets.races)
  const objectives = normalizeObjectiveFamilies(datasets['ura-objectives'], datasets.races, races.items)
  const umas = normalizeUmas(datasets['character-cards'], datasets.characters, objectives.byCharacterId)
  const cards = normalizeCards(datasets['support-cards'])
  const skills = normalizeSkills(datasets.skills)
  const courses = normalizeCourses(datasets.racetracks)
  const skillCoverage = summarizeRaceSkillCoverage(skills.items)
  const baselineSkills = selectBaselineRaceSkills(skills.items)
  assertRaceCourseContent(races.items, courses.items)

  const umaStarters = umas.items.filter((item) => item.starter).length
  const cardStarters = cards.items.filter((item) => item.starter).length
  const objectiveOutfits = umas.items.filter((item) => item.signatureRaceFamilyIds.length > 0).length
  const missingLaunchObjectives = umas.items.filter((item) => item.starter && item.signatureRaceFamilyIds.length === 0).length
  console.log(`Umas: ${umas.items.length} (${umaStarters} starters)`)
  console.log(`SSR cards: ${cards.items.length} (${cardStarters} starters)`)
  console.log(`Skills: ${skills.items.length}`)
  console.log(`Race-skill coverage: ${skillCoverage.supported}/${skillCoverage.total}`)
  console.log(`Baseline NPC skill kit: ${baselineSkills.length}/4`)
  console.log(`Races: ${races.items.length}`)
  console.log(`Objectives: ${objectives.counts.rows} rows · ${objectives.counts.characters} characters · ${objectiveOutfits} outfits · ${objectives.counts.resolvedReferences} resolved · ${objectives.counts.unresolvedReferences} unresolved`)
  console.log(`Courses: ${courses.items.length}`)

  const warnings = [...umas.warnings, ...objectives.warnings, ...cards.warnings, ...skills.warnings, ...races.warnings, ...courses.warnings]
  if (umaStarters !== 25) warnings.unshift(`Expected exactly 25 launch Umas, found ${umaStarters}`)
  if (missingLaunchObjectives > 0) warnings.unshift(`Objective metadata is missing for ${missingLaunchObjectives} launch outfit(s)`)
  for (const warning of warnings) console.warn(`Warning: ${warning}`)

  const contentManifest = await writeContentPacks({
    source,
    packs: [
      { name: 'umas', version: `${source['character-cards']!}+${source['ura-objectives']!}`, items: umas.items },
      { name: 'cards', version: source['support-cards']!, items: cards.items },
      { name: 'skills', version: source.skills!, items: skills.items },
      { name: 'races', version: source.races!, items: races.items },
      { name: 'courses', version: source.racetracks!, items: courses.items },
    ],
  })
  console.log(`Manifest: ${contentManifest.version} (${contentManifest.files.length} files)`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
