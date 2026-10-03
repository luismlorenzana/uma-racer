// Bounded private-content replay probe. Invented entrants only; prints no source names, art or rows.
import { grantRpgExp, applyAction, combatSkill, combatStateHash, createEncounter, enrollRpgOutfit, isRpgBattleNode, spendRpgTreePoint,
  projectRpgStats, replay, rpgEncounterExp, rpgTreePointsEarned, type CombatAction, type CombatState,
  type EncounterInput, type RpgChapterPack, type RpgElement, type RpgProfile, type RpgWeapon } from '@racer/domain'

function party(level: number, tier: number): RpgProfile[] {
  const paths: [RpgProfile['style'],RpgWeapon,RpgElement][]=[['front','greatsword','fire'],['pace','spear','ice'],['pace','sword-shield','light'],['late','cleric-staff','light'],['end','tome','lightning']]
  return paths.map(([style,weapon,signature],i)=>({...enrollRpgOutfit({outfit:{id:`probe-outfit-${i}`,
    baseStats:{speed:100,stamina:100,power:100,guts:100,wit:100},growthRates:{speed:0,stamina:0,power:0,guts:0,wit:0},
    aptitudes:{surface:{turf:'A',dirt:'A'},distance:{sprint:'A',mile:'A',medium:'A',long:'A'},strategy:{front:'A',pace:'A',late:'A',end:'A'}}},
    contentVersion:'invented-probe',style,weapon,defaultSignature:signature}),level,tier}))
}
function prepare(p: RpgProfile): RpgProfile {
  if (rpgTreePointsEarned(p.level) > 0 && !p.tree.length) return spendRpgTreePoint(p,{tier:p.tier,weapon:p.weapon,element:p.defaultSignature,depth:1,branch:'foundation'})
  return p
}
function action(state: CombatState): CombatAction {
  const actor=state.units.find(u=>u.side==='ally'&&u.hp>0&&!state.acted.includes(u.id))!
  const ally=state.input.allies.find(a=>a.id===actor.id)!
  const hurt=state.units.filter(u=>u.side==='ally'&&u.hp>0).sort((a,b)=>a.hp/state.input.allies.find(u=>u.id===a.id)!.stats.hp-b.hp/state.input.allies.find(u=>u.id===b.id)!.stats.hp)[0]!
  const heal=ally.loadout.find(ref=>combatSkill(ref)?.heal)
  if (heal && actor.mp>=combatSkill(heal)!.mp && hurt.hp/state.input.allies.find(a=>a.id===hurt.id)!.stats.hp<0.7)
    return {kind:'skill',actorId:actor.id,targetId:hurt.id,skill:heal}
  const target=state.units.filter(u=>u.side==='enemy'&&u.hp>0).sort((a,b)=>a.hp-b.hp||a.id.localeCompare(b.id))[0]!
  // Offensive skills only; a support-only technique must not be aimed at an enemy.
  const skill=ally.loadout.find(ref=>combatSkill(ref)?.base && !combatSkill(ref)?.heal)
  return skill && actor.mp>=combatSkill(skill)!.mp ? {kind:'skill',actorId:actor.id,targetId:target.id,skill} : {kind:'attack',actorId:actor.id,targetId:target.id}
}
export function replayPrivateRpgPack(pack: RpgChapterPack) {
  let routes=0,clears=0,phaseShifts=0,fights=0,rounds=0,hashChecks=0
  const endLevels:number[]=[]
  for (const chapter of pack.chapters) {
    const paths:string[][]=[]
    const visit=(id:string,path:string[])=>{
      if(paths.length>=64)throw new Error('Private replay route budget exceeded; use a smaller authoring probe')
      const node=chapter.nodes.find(n=>n.id===id)!,next=[...path,id]
      if(!node.exits.length)paths.push(next);else node.exits.forEach(exit=>visit(exit,next))
    }
    visit(chapter.startNodeId,[])
    for (const path of paths) for (const seed of [101,313,701]) {
      routes++;let profiles=party(chapter.recommendedLevel,chapter.recommendedTier),won=true
      for(const id of path) {
        const node=chapter.nodes.find(n=>n.id===id)!;if(!isRpgBattleNode(node))continue
        profiles=profiles.map(prepare)
        const input:EncounterInput={version:1,seed,contentVersion:pack.version,weaknessFollowUp:'bounded',
          allies:profiles.map(p=>({id:p.outfitId,style:p.style,weapon:p.weapon,tier:p.tier,level:p.level,stats:projectRpgStats(p),affinities:p.affinities,
            signature:p.defaultSignature,tree:p.tree,legacy:p.legacy,loadout:p.tree.map(({level:_level,...ref})=>ref)})),
          enemies:node.enemies.map(id=>pack.actors.find(a=>a.id===id)!.combat)}
        let state=createEncounter(input).state;const actions:CombatAction[]=[]
        while(state.outcome==='active') {
          const choice=action(state),step=applyAction(state,choice)
          if(step.error)throw new Error('Private probe chose an illegal action')
          actions.push(choice);state=step.state;phaseShifts+=step.cues.filter(c=>c.kind==='phase').length
        }
        const restored=replay(JSON.parse(JSON.stringify(input)) as EncounterInput,JSON.parse(JSON.stringify(actions)) as CombatAction[])
        if(restored.error || restored.hash!==combatStateHash(state))throw new Error('Private content replay hash changed')
        hashChecks++;fights++;rounds+=state.round
        if(state.outcome!=='victory'){won=false;break}
        profiles=profiles.map(p=>grantRpgExp(p,rpgEncounterExp({baseExp:node.baseExp!,recommendedLevel:chapter.recommendedLevel,recommendedTier:chapter.recommendedTier},p)).profile)
      }
      if(won){clears++;endLevels.push(...profiles.map(p=>p.level))}
    }
  }
  return {routes,clears,fights,meanRounds:fights?Number((rounds/fights).toFixed(2)):0,phaseShifts,hashChecks,
    endLevelRange:endLevels.length?[Math.min(...endLevels),Math.max(...endLevels)]:[],
    entrantSource:'invented base-100, no growth, mixed five-weapon party; not production balance sign-off'}
}
