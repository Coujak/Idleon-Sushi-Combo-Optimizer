// Scale Knowledge research continuation to 5% of completed refill waves.
// A starting preview of 6 refills still advances by at least one wave.
export function knowledgeContinueWaveCount(completedRefills){
 const completed=Number(completedRefills);
 if(!Number.isFinite(completed)||completed<0)return 1;
 return Math.max(1,Math.round(Math.floor(completed)*0.05));
}
export function knowledgeContinueButtonLabel(completedRefills){
 const waves=knowledgeContinueWaveCount(completedRefills);
 return "Continue rotation +"+waves+" refill"+(waves===1?"":"s");
}
