// Idleon cloud-save read-only connection.
// Firebase configuration is a public client identifier, not an admin key.
// Login tokens and Steam callbacks remain in memory and never go into storage.
export const STEAM_LOGIN_URL = "https://steamcommunity.com/openid/login?"+
 "openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0&"+
 "openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&"+
 "openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&"+
 "openid.return_to=https%3A%2F%2Fwww.legendsofidleon.com%2Fsteamsso%2F&"+
 "openid.realm=https%3A%2F%2Fwww.legendsofidleon.com%2Fsteamsso%2F&"+
 "openid.mode=checkid_setup";

const AUTH_ENDPOINT="https://us-central1-idlemmo.cloudfunctions.net/asil";
const FIREBASE_VERSION="12.19.0";
const FIREBASE_APP_NAME="sushi-station-idleon";
const FIREBASE_CONFIG={
 apiKey:"AIzaSyAU62kOE6xhSrFqoXQPv6_WHxYilmoUxDk",
 authDomain:"idlemmo.firebaseapp.com",
 databaseURL:"https://idlemmo.firebaseio.com",
 storageBucket:"idlemmo.appspot.com",
 projectId:"idlemmo"
};

export function parseSteamCallback(value){
 if(typeof value!=="string"||value.trim().length>8192)
  throw Error("Paste the Steam sign-in return address from legendsofidleon.com.");
 let url;
 try{
  const raw=value.trim();
  url=new URL(/^(?:www\.)?legendsofidleon\.com\/steamsso\//i.test(raw)?
   "https://"+raw.replace(/^www\./i,"www."):raw);
 }catch{
  throw Error("Paste the return-page address from the official Idleon Steam sign-in.");
 }
 if(url.protocol!=="https:"||url.hostname!=="www.legendsofidleon.com"||
  url.port||url.username||url.password||url.pathname!=="/steamsso/")
  throw Error("Only the official legendsofidleon.com/steamsso/ return address is accepted.");
 const params=url.searchParams;
 const claimed=params.get("openid.claimed_id");
 let idUrl;
 try{idUrl=new URL(claimed);}catch{
  throw Error("That return address is missing Steam's signed OpenID information.");
 }
 if(idUrl.protocol!=="https:"&&idUrl.protocol!=="http:"||
  idUrl.hostname!=="steamcommunity.com"||
  !/^\/openid\/id\/\d{12,20}$/.test(idUrl.pathname))
  throw Error("That return address does not contain a valid Steam identity.");
 const nonce=params.get("openid.response_nonce");
 const sig=params.get("openid.sig");
 const signed=params.get("openid.signed");
 if(!nonce||!sig||!signed)
  throw Error("That Steam return address is incomplete or expired. Sign in again.");
 return {
  claimedId:idUrl.pathname.split("/").at(-1),nonce,
  assocHandle:params.get("openid.assoc_handle")??"",
  sig,signed
 };
}

// Never retain the complete cloud save in our application state. Keep only
// arrays/records consumed by our existing parser and planners.
export function selectSushiCloudData(save){
 const fields=save?.data&&typeof save.data==="object"?save.data:save;
 if(!fields||typeof fields!=="object"||fields.Sushi==null)
  throw Error("This Idleon cloud save has no Sushi Station data yet.");
 const chosen={};
 for(const field of ["Sushi","Spelunk","Menagerie","Research","BundlesReceived"])
  if(Object.prototype.hasOwnProperty.call(fields,field))chosen[field]=fields[field];
 return chosen;
}

export function cloudLoginError(error){
 const code=String(error?.code??"");
 if(code==="auth/invalid-custom-token"||code==="auth/custom-token-mismatch")
  return "Idleon did not accept this Steam login. Start a new Steam sign-in.";
 if(code==="permission-denied")return "Idleon denied access to this cloud save.";
 if(code==="unavailable")return "Idleon's cloud-save service is temporarily unavailable.";
 if(code==="auth/network-request-failed")
  return "Could not reach Idleon Firebase. Check your connection.";
 if(error?.name==="TypeError")
  return "Could not reach the Idleon sign-in service. Browser restrictions or network access may be blocking it.";
 // Validation errors from our own parser contain no credentials; SDK errors
 // can carry sensitive details, so they must never be printed in the UI.
 if(error?.isSafeIdleonError)return error.message;
 if(code==="idleon/no-save")return "Your Idleon account has no accessible cloud save.";
 return "Idleon sign-in or save loading failed. Try a fresh Steam sign-in, or import JSON instead.";
}

const safeError=message=>Object.assign(new Error(message),{isSafeIdleonError:true});

async function loadFirebase(){
 // Firebase SDK is fetched only after the user explicitly connects.
 const root="https://www.gstatic.com/firebasejs/"+FIREBASE_VERSION+"/";
 const [core,authTools,dbTools]=await Promise.all([
  import(root+"firebase-app.js"),
  import(root+"firebase-auth.js"),
  import(root+"firebase-firestore.js")
 ]);
 const app=core.getApps().find(x=>x.name===FIREBASE_APP_NAME)??
  core.initializeApp(FIREBASE_CONFIG,FIREBASE_APP_NAME);
 const auth=authTools.getAuth(app);
 await authTools.setPersistence(auth,authTools.inMemoryPersistence);
 return {auth,authTools,db:dbTools.getFirestore(app),dbTools};
}

async function exchangeSteamResponse(signed){
 const response=await fetch(AUTH_ENDPOINT,{
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify({data:signed}),
  cache:"no-store",
  referrerPolicy:"no-referrer"
 });
 if(!response.ok)throw safeError("Idleon rejected the Steam sign-in response. Sign in again.");
 const data=await response.json().catch(()=>null);
 if(typeof data?.result!=="string"||!data.result)
  throw safeError("Idleon did not return a login session. Sign in again.");
 return data.result;
}

export function createIdleonCloudClient({load=loadFirebase,exchange=exchangeSteamResponse}={}){
 let connection=null;
 const ensure=async()=>{
  if(!connection)connection=await load();
  return connection;
 };
 async function readCloud(user){
  if(!user?.uid)throw safeError("No signed-in Idleon account is available.");
  const {db,dbTools}=await ensure();
  const snapshot=await dbTools.getDocFromServer(dbTools.doc(db,"_data",user.uid));
  if(!snapshot.exists())throw Object.assign(new Error("No save"),{code:"idleon/no-save"});
  return selectSushiCloudData(snapshot.data());
 }
 return {
  async connectSteam(callbackUrl){
   // Parse before loading Firebase so an invalid or malicious pasted URL
   // cannot trigger any network requests.
   const signed=parseSteamCallback(callbackUrl);
   const token=await exchange(signed);
   const {auth,authTools}=await ensure();
   try{
    const login=await authTools.signInWithCustomToken(auth,token);
    return await readCloud(login.user);
   }catch(error){
    await authTools.signOut(auth).catch(()=>{});
    throw error;
   }
  },
  async refresh(){
   const {auth}=await ensure();
   if(!auth.currentUser)throw safeError("Connect your Idleon account first.");
   return readCloud(auth.currentUser);
  },
  async disconnect(){
   if(!connection)return;
   const {auth,authTools}=connection;
   await authTools.signOut(auth);
  },
  isConnected(){return Boolean(connection?.auth?.currentUser);}
 };
}
