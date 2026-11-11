// Sushi Station tier progression from exported game data.
// Sushi[0] is the current board (zero-based IDs), while Sushi[5] is the
// discovery/Perfecto tracker: -1=undiscovered, 0=discovered,
// and positive=discovered with Perfecto recorded.
// Reading the board alone underestimates what a user can prepare.
export function detectSushiProgress(save){
 const board=Array.isArray(save?.tiles)?save.tiles:[];
 const highestOnBoard=board.reduce((highest,value)=>{
  const tier=Number(value);
  return Number.isInteger(tier)&&tier>=0?Math.max(highest,tier+1):highest;
 },0);
 const tracking=Array.isArray(save?.sushi?.[5])?save.sushi[5]:
  Array.isArray(save?.perfecto)?save.perfecto:null;
 const highestDiscovered=tracking?tracking.reduce((highest,value,index)=>{
  const state=Number(value);
  return Number.isFinite(state)&&state>=0?Math.max(highest,index+1):highest;
 },0):0;
 const highest=Math.max(highestOnBoard,highestDiscovered);
 const source=highestDiscovered>=highestOnBoard&&highestDiscovered>0?
  "Highest discovered sushi tier (Sushi discovery tracker)":
  "Highest sushi found on board (fallback)";
 return {highest,highestOnBoard,highestDiscovered,source,
  windCap:Math.max(0,highest-6)};
}
