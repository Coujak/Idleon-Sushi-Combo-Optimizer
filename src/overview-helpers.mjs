// Pure helpers for the account Overview. The current catalog has 64 tiers.
import {SUSHI_KNOWLEDGE} from "./sushi-reference.mjs";

export const OVERVIEW_PLATE_TYPES=["Regular","Hot","Cold","Milktoast"];

export function countOverviewPlates(slots=[]){
 const counts=Array(OVERVIEW_PLATE_TYPES.length).fill(0);
 for(const type of slots){
  if(Number.isInteger(type)&&type>=0&&type<counts.length)counts[type]++;
 }
 return counts;
}

export function overviewTierProgress(rows=[]){
 const total=rows.length;
 const discovered=rows.filter(row=>row.discovered).length;
 const perfectos=rows.filter(row=>row.perfecto&&row.discovered).length;
 const highestDiscovered=rows.reduce((max,row)=>
  row.discovered?Math.max(max,row.tier):max,0);
 return {total,discovered,perfectos,highestDiscovered,
  missingPerfectos:Math.max(0,discovered-perfectos),
  missingTiers:Math.max(0,total-discovered)};
}

export function overviewTileInfo({tiles=[],slots=[],perfecto=[]},index){
 if(!Number.isInteger(index)||index<0||index>=120)return null;
 const type=slots[index]??-1,plate=OVERVIEW_PLATE_TYPES[type]??"Locked";
 if(type<0)return {position:index+1,plate,tier:null,name:null,status:"Locked"};
 const id=tiles[index]??-1;
 if(id<0)return {position:index+1,plate,tier:null,name:null,status:"Empty"};
 const tier=id+1;
 const name=SUSHI_KNOWLEDGE.find(entry=>entry.tier===tier)?.name??"Unknown sushi";
 const isPerfecto=Number(perfecto?.[id])>0;
 return {position:index+1,plate,tier,name,status:isPerfecto?"Perfecto":"Not Perfecto"};
}

export function importAgeText(timestamp,now=Date.now()){
 if(!Number.isFinite(timestamp))return "No save imported";
 const minutes=Math.max(0,Math.floor((now-timestamp)/60000));
 if(minutes<1)return "Imported just now";
 if(minutes<60)return "Imported "+minutes+" min ago";
 const hours=Math.floor(minutes/60);
 if(hours<24)return "Imported "+hours+" hr ago";
 const days=Math.floor(hours/24);
 return "Imported "+days+" day"+(days===1?"":"s")+" ago";
}
