// Display-only formatting shared by the entire Sushi Station optimizer.
// Preserve raw numeric values for costs, simulation and JSON imports.
const SUFFIXES=[
 [1e18,"QQ"],[1e15,"Q"],[1e12,"T"],[1e9,"B"],[1e6,"M"],[1e3,"K"]
];
const cleanDecimal=(value,digits)=>Number(value.toFixed(digits)).toLocaleString("en-US",{maximumFractionDigits:digits});
export function formatCompactNumber(value,{digits=3,unavailable="Unavailable"}={}){
 if(typeof value!=="number"||!Number.isFinite(value))return unavailable;
 if(value===0)return "0";
 const abs=Math.abs(value);
 const precision=Math.max(0,Math.min(12,Math.trunc(digits)||0));
 if(abs>=1e21||abs<.001){
  const [mantissa,exponent]=value.toExponential(precision).split("e");
  const clean=mantissa.includes(".")?mantissa.replace(/0+$/,"").replace(/\.$/,""):mantissa;
  return clean+"E"+String(Number(exponent));
 }
 for(const [threshold,suffix] of SUFFIXES){
  if(abs>=threshold)return cleanDecimal(value/threshold,precision)+suffix;
 }
 return value.toLocaleString("en-US",{maximumFractionDigits:abs<10?precision:Math.min(2,precision)});
}
