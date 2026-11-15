// Local development prototype only. Never commit an OAuth client secret.
// Google credentials and Firebase tokens stay in memory; this module writes no storage.
const API_KEY="AIzaSyAU62kOE6xhSrFqoXQPv6_WHxYilmoUxDk";
const DEVICE_URL="https://oauth2.googleapis.com/device/code";
const TOKEN_URL="https://oauth2.googleapis.com/token";
const IDP_URL="https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key="+API_KEY;
const FIRESTORE_URL="https://firestore.googleapis.com/v1/projects/idlemmo/databases/(default)/documents/_data/";
const REFRESH_URL="https://securetoken.googleapis.com/v1/token?key="+API_KEY;
const GRANT="urn:ietf:params:oauth:grant-type:device_code";
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function postForm(url,params){
 const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(params),cache:"no-store"});
 const data=await response.json().catch(()=>({}));
 return {response,data};
}
function unpack(value){
 if(!value||typeof value!=="object")return null;
 if("stringValue" in value)return value.stringValue;
 if("integerValue" in value){const n=Number(value.integerValue);return Number.isSafeInteger(n)?n:String(value.integerValue);}
 if("doubleValue" in value)return Number(value.doubleValue);
 if("booleanValue" in value)return value.booleanValue;
 if("nullValue" in value)return null;
 if("arrayValue" in value)return (value.arrayValue?.values??[]).map(unpack);
 if("mapValue" in value)return unpackFields(value.mapValue?.fields??{});
 return null;
}
function unpackFields(fields){
 const result=Object.create(null);
 for(const [key,value] of Object.entries(fields))if(!["__proto__","constructor","prototype"].includes(key))result[key]=unpack(value);
 return result;
}
export function createLocalGoogleDeviceAuth({fetcher=fetch,sleep=delay,clock=()=>Date.now()}={}){
 let generation=0,session=null;
 async function codeRequest(clientId){
  const response=await fetcher(DEVICE_URL,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({client_id:clientId,scope:"email profile"}),cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.device_code||!data.user_code)throw Error(data.error_description||data.error||"Google did not issue a device code.");
  return data;
 }
 async function readSave(s){
  const response=await fetcher(FIRESTORE_URL+encodeURIComponent(s.uid),{headers:{Authorization:"Bearer "+s.idToken},cache:"no-store"});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error("Idleon cloud save unavailable ("+response.status+").");
  const save=unpackFields(data.fields??{});
  if(save.Sushi==null)throw Error("No Sushi Station data found in the authorized cloud save.");
  return {data:save};
 }
 async function renew(){
  if(!session)throw Error("Sign in first.");
  if(clock()<session.expiresAt-300000)return session;
  const {response,data}=await postForm(REFRESH_URL,{grant_type:"refresh_token",refresh_token:session.refreshToken});
  if(!response.ok||!data.id_token)throw Error("Firebase session expired. Sign in again.");
  session={uid:data.user_id||session.uid,idToken:data.id_token,refreshToken:data.refresh_token||session.refreshToken,
   expiresAt:clock()+Number(data.expires_in||3600)*1000};
  return session;
 }
 return {
  async start(clientId,clientSecret,onStatus=()=>{}){
   const seq=++generation;
   session=null;
   if(!/^[\\w-]+\\.apps\\.googleusercontent\\.com$/.test(clientId))throw Error("Invalid Google OAuth Client ID.");
   if(!clientSecret?.trim())throw Error("Client Secret is needed for this local device-code test.");
   const data=await codeRequest(clientId);
   const deadline=clock()+Number(data.expires_in||1800)*1000;
   let interval=Math.max(1000,Number(data.interval||5)*1000);
   const approval=(async()=>{
    while(seq===generation&&clock()<deadline){
     await sleep(interval);
     if(seq!==generation)return null;
     let response,payload;
     try{
      const result=await postForm(TOKEN_URL,{client_id:clientId,client_secret:clientSecret,
       device_code:data.device_code,grant_type:GRANT});
      response=result.response;payload=result.data;
     }catch(err){throw Error("Could not poll Google: "+err.message);}
     if(payload.error==="authorization_pending"){onStatus("Waiting for Google approval…");continue;}
     if(payload.error==="slow_down"){interval+=5000;onStatus("Google asked us to poll less frequently…");continue;}
     if(payload.error==="access_denied")throw Error("Google authorization was denied.");
     if(payload.error==="expired_token")throw Error("The device code expired. Generate another.");
     if(!response.ok||!payload.id_token)throw Error(payload.error_description||payload.error||"Google did not return an ID token.");
     onStatus("Google approved · authenticating with Idleon Firebase…");
     const result=await fetcher(IDP_URL,{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({postBody:new URLSearchParams({id_token:payload.id_token,providerId:"google.com"}).toString(),
       requestUri:"http://localhost",returnSecureToken:true}),cache:"no-store"});
     const auth=await result.json().catch(()=>({}));
     if(!result.ok||!auth.idToken||!auth.localId)
      throw Error("Idleon Firebase rejected this Google account ("+(auth.error?.message||result.status)+").");
     if(seq!==generation)return null;
     session={uid:auth.localId,idToken:auth.idToken,refreshToken:auth.refreshToken,
      expiresAt:clock()+Number(auth.expiresIn||3600)*1000};
     onStatus("Google approved · loading Idleon cloud save…");
     return readSave(session);
    }
    if(seq!==generation)return null;
    throw Error("The device code expired. Generate another.");
   })();
   // Return immediately while the approval loop runs asynchronously.
   return {userCode:data.user_code,verificationUrl:data.verification_url||"https://www.google.com/device",complete:approval,
    cancel:()=>{if(seq===generation)generation++;}};
  },
  async refresh(){return readSave(await renew());},
  signOut(){generation++;session=null;},
  isConnected(){return Boolean(session);}
 };
}
