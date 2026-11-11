// Google device-authorization support for a future authorized Idleon integration.
// The OAuth client/exchange must be owned or explicitly authorized for this app.
// Never bundle a third-party application's client_secret into GitHub Pages.
export const GOOGLE_DEVICE_VERIFICATION_URL="https://www.google.com/device";

function validText(value,max=512){
 return typeof value==="string"&&value.length>0&&value.length<=max;
}

// This function owns only public user-facing code metadata. The confidential
// device_code belongs in the in-memory controller, never in a saved artifact.
export function validateGoogleDeviceAuthorization(response,now=Date.now()){
 if(!response||!validText(response.user_code,128)||
  !validText(response.device_code,2048))throw Error("Google did not return a usable device code.");
 const expiresIn=Number(response.expires_in);
 if(!Number.isInteger(expiresIn)||expiresIn<10||expiresIn>3600)
  throw Error("Google returned an invalid device-code expiry.");
 const interval=Number(response.interval??5);
 if(!Number.isInteger(interval)||interval<1||interval>120)
  throw Error("Google returned an invalid polling interval.");
 const url=response.verification_url??GOOGLE_DEVICE_VERIFICATION_URL;
 let parsed;
 try{parsed=new URL(url);}catch{
  throw Error("Google returned an invalid verification address.");
 }
 if(parsed.protocol!=="https:"||!["www.google.com","google.com"].includes(parsed.hostname)||
  parsed.username||parsed.password||parsed.port||parsed.pathname!=="/device")
  throw Error("Google returned an unexpected verification address.");
 return {
  userCode:response.user_code,
  deviceCode:response.device_code,
  verificationUrl:parsed.href,
  expiresAt:now+expiresIn*1000,
  intervalMs:interval*1000
 };
}

export function nextGoogleDevicePoll(result,intervalMs,now,expiresAt){
 if(now>=expiresAt)return {status:"expired"};
 const code=String(result?.error??"");
 if(code==="authorization_pending")
  return {status:"pending",nextIntervalMs:intervalMs};
 if(code==="slow_down")
  return {status:"pending",nextIntervalMs:Math.min(120000,intervalMs+5000)};
 if(code==="access_denied")return {status:"denied"};
 if(code==="expired_token")return {status:"expired"};
 if(code)return {status:"failed"};
 // For Firebase signInWithCredential the identity token, NOT the access token,
 // is needed; never fall back to a token with the wrong audience.
 if(!validText(result?.id_token,8192))return {status:"failed"};
 return {status:"authorized",idToken:result.id_token};
}

// Injectable broker interface: an authorized backend may exchange a device
// code with the proper OAuth client credentials. No credentials are kept here.
// The caller owns cancellation, and must not persist returned Firebase tokens.
export function createGoogleDeviceFlow({
 requestDeviceCode,exchangeDeviceCode,authenticate,readCloud,
 now=()=>Date.now(),sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms))
}){
 if([requestDeviceCode,exchangeDeviceCode,authenticate,readCloud].some(x=>typeof x!=="function"))
  throw Error("Google device flow requires an authorized OAuth broker and Firebase adapter.");
 let generation=0;
 let active=null;
 return {
  async start(){
   const seq=++generation;
   active=null;
   const config=validateGoogleDeviceAuthorization(await requestDeviceCode(),now());
   if(seq!==generation)return null;
   active=config;
   // Return only the user code and verification URL. Never render device_code.
   return {userCode:config.userCode,verificationUrl:config.verificationUrl,
    expiresAt:config.expiresAt,intervalMs:config.intervalMs};
  },
  async complete(){
   const config=active;
   const seq=generation;
   if(!config)throw Error("Start Google device authorization first.");
   let interval=config.intervalMs;
   while(seq===generation&&now()<config.expiresAt){
    await sleep(interval);
    if(seq!==generation)return null;
    const decision=nextGoogleDevicePoll(
     await exchangeDeviceCode(config.deviceCode),interval,now(),config.expiresAt);
    if(seq!==generation)return null;
    if(decision.status==="pending"){interval=decision.nextIntervalMs;continue;}
    if(decision.status==="denied")throw Error("Google sign-in was cancelled.");
    if(decision.status==="expired")throw Error("Google sign-in code expired.");
    if(decision.status!=="authorized")throw Error("Google could not complete sign-in.");
    try{
     const user=await authenticate(decision.idToken);
     if(seq!==generation)return null;
     return await readCloud(user);
    }finally{active=null;}
   }
   if(seq!==generation)return null;
   active=null;
   throw Error("Google sign-in code expired.");
  },
  cancel(){generation++;active=null;},
  isPending(){return Boolean(active);}
 };
}
