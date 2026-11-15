// Experimental Google-to-Idleon import. Browser credentials live only in the active flow.
// Never reuse another site's OAuth client/secret, store tokens, or treat Google sign-in
// alone as proof that the game's Firebase project authorized the credential.
const AUTH_ENDPOINT="https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp";
const FIRESTORE_HOST="https://firestore.googleapis.com";
const DEFAULT_PROJECT="idlemmo";

export function validateGoogleImportConfig(config){
 const clientId=String(config?.clientId??"").trim();
 const firebaseApiKey=String(config?.firebaseApiKey??"").trim();
 const projectId=String(config?.projectId??DEFAULT_PROJECT).trim();
 if(!/^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId))
  return {ready:false,reason:"Configure an authorized Google OAuth Web client ID before using this preview."};
 if(!/^[a-zA-Z0-9_-]{20,}$/.test(firebaseApiKey))
  return {ready:false,reason:"Configure the game's verified public Firebase API key before testing."};
 if(!/^[a-z][a-z0-9-]{3,63}$/.test(projectId))
  return {ready:false,reason:"The Firebase project ID is invalid."};
 return {ready:true,clientId,firebaseApiKey,projectId};
}
export function googleImportError(error,stage){
 const code=String(error?.message??error??"").trim().slice(0,180);
 if(/INVALID_IDP_RESPONSE|INVALID_CREDENTIAL_OR_PROVIDER_ID|INVALID_OAUTH_CLIENT_ID/.test(code))
  return new Error("Idleon Firebase rejected this Google credential. Google sign-in succeeded, but the OAuth client may not be authorized for the game's Firebase project. Continue using JSON import.");
 if(/PERMISSION_DENIED|UNAUTHENTICATED|403/.test(code))
  return new Error("Idleon did not authorize access to this account's cloud save. Try the matching game-linked Google account or import JSON.");
 if(stage==="firestore"&&/404|NOT_FOUND/.test(code))
  return new Error("No Idleon cloud save was found for this Google-linked account. JSON import is still available.");
 if(/Failed to fetch|NetworkError|CORS/.test(code))
  return new Error("Google/Idleon request failed or was blocked by the browser. Check the connection and CORS configuration.");
 return new Error(stage==="firebase"?"Idleon Firebase sign-in could not be completed. JSON import is still available.":"Could not retrieve a valid Sushi Station cloud save. JSON import is still available.");
}
export function unpackFirestoreValue(value,depth=0){
 if(depth>40)throw Error("Firestore data exceeds maximum nesting depth");
 if(!value||typeof value!=="object")return null;
 if("nullValue" in value)return null;
 if("stringValue" in value)return String(value.stringValue);
 if("booleanValue" in value)return Boolean(value.booleanValue);
 if("integerValue" in value){
  const raw=String(value.integerValue);
  const n=Number(raw);
  return Number.isSafeInteger(n)?n:raw;
 }
 if("doubleValue" in value){const n=Number(value.doubleValue);return Number.isFinite(n)?n:null;}
 if("arrayValue" in value)return (value.arrayValue?.values??[]).map(x=>unpackFirestoreValue(x,depth+1));
 if("mapValue" in value)return unpackFirestoreFields(value.mapValue?.fields??{},depth+1);
 if("timestampValue" in value)return String(value.timestampValue);
 return null;
}
export function unpackFirestoreFields(fields,depth=0){
 if(!fields||typeof fields!=="object"||Array.isArray(fields))throw Error("Invalid Firestore data format");
 const output=Object.create(null);
 for(const [key,value] of Object.entries(fields)){
  if(key==="__proto__"||key==="prototype"||key==="constructor")continue;
  output[key]=unpackFirestoreValue(value,depth);
 }
 return output;
}
async function readJson(response){
 let json=null;
 try{json=await response.json();}catch{}
 return json;
}
export async function exchangeGoogleForIdleon(googleAccessToken,config,fetcher=fetch){
 if(typeof googleAccessToken!=="string"||googleAccessToken.length<15)throw Error("Google OAuth access token is missing.");
 const settings=validateGoogleImportConfig(config);
 if(!settings.ready)throw Error(settings.reason);
 let response,json;
 try{
  response=await fetcher(AUTH_ENDPOINT+"?key="+encodeURIComponent(settings.firebaseApiKey),{
   method:"POST",headers:{"Content-Type":"application/json"},
   cache:"no-store",
   body:JSON.stringify({
    postBody:new URLSearchParams({access_token:googleAccessToken,providerId:"google.com"}).toString(),
    requestUri:"http://localhost",returnSecureToken:true
   })
  });
  json=await readJson(response);
 }catch(e){throw googleImportError(e,"firebase");}
 if(!response.ok||!json?.idToken||!json?.localId){
  throw googleImportError(Error(json?.error?.message??"Firebase rejected credentials"),"firebase");
 }
 return {uid:json.localId,idToken:json.idToken};
}
export async function fetchAuthorizedIdleonSave(uid,firebaseIdToken,config,fetcher=fetch){
 if(typeof uid!=="string"||!uid||typeof firebaseIdToken!=="string"||!firebaseIdToken)
  throw Error("Authorized Firebase session is missing.");
 const settings=validateGoogleImportConfig(config);
 if(!settings.ready)throw Error(settings.reason);
 const url=FIRESTORE_HOST+"/v1/projects/"+encodeURIComponent(settings.projectId)+
  "/databases/(default)/documents/_data/"+encodeURIComponent(uid);
 let response,json;
 try{
  response=await fetcher(url,{method:"GET",headers:{Authorization:"Bearer "+firebaseIdToken},cache:"no-store"});
  json=await readJson(response);
 }catch(e){throw googleImportError(e,"firestore");}
 if(!response.ok||!json?.fields)throw googleImportError(Error(json?.error?.message??String(response.status)),"firestore");
 const data=unpackFirestoreFields(json.fields);
 if(!data.Sushi)throw Error("This Idleon cloud save contains no readable Sushi Station data. Import an Idleon Toolbox JSON instead.");
 return {data};
}
export async function importGoogleIdleonSave(accessToken,config,fetcher=fetch){
 const {uid,idToken}=await exchangeGoogleForIdleon(accessToken,config,fetcher);
 return fetchAuthorizedIdleonSave(uid,idToken,config,fetcher);
}
