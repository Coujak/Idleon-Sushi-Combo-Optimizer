// Temporary public-metadata inspection. No user save data is loaded or uploaded.
import test from "node:test";
test("inspect public Sushi multiplier metadata",async()=>{
 const url="https://raw.githubusercontent.com/Morta1/IdleonToolbox/main/data/website-data/shared-data.json";
 try {
  const response=await fetch(url,{signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw new Error("HTTP "+response.status);
  const d=await response.json();
  const shop=d.arcadeShop??[];
  const i=shop.findIndex(x=>/Sushi_Bucks/i.test(x?.effect??""));
  console.info("SUSHI_PUBLIC_METADATA",JSON.stringify({
   arcadeShopLength:shop.length,arcadeIndex:i,arcadeShop:shop[i],
   atom14:(d.atomsInfo??[])[14],
   buttonPerPress:d.ButtonBonusPerPress,
   companions55:(d.companions??[])[55],
   gameshop:d.superbitsUpgrades?.[67]
  }));
 }catch(err){console.info("SUSHI_PUBLIC_METADATA unavailable",String(err));}
});
