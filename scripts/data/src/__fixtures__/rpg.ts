// Small invented pipeline fixture. No third-party rows, stats, names or art.
import type { RpgChapterNode } from '@racer/domain'
export function rpgFixture(version='example-v1') {
  const actors=['example-scout','example-captain'].map((id,i)=>({id,name:i?'Example captain':'Example scout',role:'Invented role',artKey:id,
    source:{characterId:id,pageUrl:`https://priconne-redive.jp/character/${id}/`,portraitUrl:`https://images.microcms-assets.io/assets/${id}.png`,
      variant:'Invented portrait',attribution:'Synthetic fixture',verifiedAt:'2099-01-01T00:00:00.000Z'},
    combat:{id,element:'ice',stats:{speed:10,stamina:10,power:10,guts:10,wit:10,atk:10,matk:10,initiative:10,pdef:10,mdef:10,dexterity:10,hp:100,mp:30},
      moves:[{id:'strike',kind:'damage',channel:'physical',element:null,power:100,target:'front',intentText:'Invented strike'}],
      ...(i?{phaseTwo:{thresholdPercent:50,moves:[{id:'heal',kind:'heal',channel:'magical',element:'light',power:100,target:'self',intentText:'Invented recovery'}]}}:{})}}))
  const nodes:RpgChapterNode[]=[
    {id:'opening',name:'Opening',kind:'encounter',detail:'Invented encounter',enemies:['example-scout'],exits:['fork'],baseExp:600},
    {id:'fork',name:'Fork',kind:'branch',detail:'Invented choice',enemies:[],exits:['rest','elite']},
    {id:'rest',name:'Rest',kind:'recovery',detail:'Invented preparation',enemies:[],exits:['join']},
    {id:'elite',name:'Elite',kind:'elite',detail:'Invented extra fight',enemies:['example-scout'],exits:['join'],baseExp:420},
    {id:'join',name:'Join',kind:'checkpoint',detail:'Invented setup stop',enemies:[],exits:['boss']},
    {id:'boss',name:'Boss',kind:'boss',detail:'Invented phase change',enemies:['example-captain'],exits:[],baseExp:1350}]
  return {schemaVersion:2,version,actors,chapters:[{id:'example-chapter',scenarioId:'ura-finale',title:'Invented chapter',contentVersion:version,
    recommendedTier:1,recommendedLevel:1,surface:'turf',distance:'medium',startNodeId:'opening',bossNodeId:'boss',nodes}]}
}
