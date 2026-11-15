// Experimental sign-in through Idleon's publicly published Firebase project.
// The app never asks for a password, copies another site's OAuth client or stores tokens.
// This only succeeds if the game's Firebase configuration authorizes this origin.
import {fetchAuthorizedIdleonSave} from "./google-idleon-import.mjs?v=1.0.1";

const FIREBASE_PROJECT=Object.freeze({
 apiKey:"AIzaSyAU62kOE6xhSrFqoXQPv6_WHxYilmoUxDk",
 authDomain:"idlemmo.firebaseapp.com",
 projectId:"idlemmo",
 databaseURL:"https://idlemmo.firebaseio.com"
});
const SDK_VERSION="11.10.0";
let pending=null;

export function describeIdleonPopupError(error){
 const code=String(error?.code??error?.message??"");
 if(/auth\/unauthorized-domain|auth\/invalid-continue-uri|auth\/unauthorized-continue-uri/.test(code))
  return "Idleon's Firebase has not authorized this website for popup sign-in. We cannot change that from Sushi Station Lab. Manual JSON import still works.";
 if(/auth\/popup-blocked/.test(code))
  return "The browser blocked Google's sign-in window. Allow popups for this page and try again.";
 if(/auth\/popup-closed-by-user|auth\/cancelled-popup-request/.test(code))
  return "Google sign-in was canceled. Your existing account data was not changed.";
 if(/auth\/operation-not-allowed|auth\/invalid-oauth-client-id|INVALID_IDP_RESPONSE|auth\/invalid-credential/.test(code))
  return "Idleon's Firebase refused this Google sign-in method. We need an officially authorized client; another website's credentials will not be copied.";
 if(/PERMISSION_DENIED|UNAUTHENTICATED|auth\/user-disabled|403/.test(code))
  return "Idleon did not authorize access to this cloud save. JSON import is still available.";
 if(/auth\/network-request-failed|Failed to fetch|NetworkError|CORS/i.test(code))
  return "The Google or Idleon service could not be reached from this browser. Check your connection and try again.";
 return "Google/Idleon sign-in did not finish. JSON import is still available. ("+
  (/^auth\/[a-z-]+$/.test(code)?code:"An authorization or save-loading error")+")";
}

export function preloadIdleonPopup(){
 if(pending)return pending;
 pending=(async()=>{
  // Google publishes these official ESM builds. No third-party script or site credentials.
  const [appModule,authModule]=await Promise.all([
   import("https://www.gstatic.com/firebasejs/"+SDK_VERSION+"/firebase-app.js"),
   import("https://www.gstatic.com/firebasejs/"+SDK_VERSION+"/firebase-auth.js")
  ]);
  const existing=appModule.getApps().find(app=>app.name==="sushi-lab-idleon-preview");
  const app=existing??appModule.initializeApp(FIREBASE_PROJECT,"sushi-lab-idleon-preview");
  const auth=authModule.initializeAuth(app,{
   persistence:authModule.inMemoryPersistence,
   popupRedirectResolver:authModule.browserPopupRedirectResolver
  });
  return {auth,authModule};
 })().catch(error=>{pending=null;throw error;});
 return pending;
}

export async function signInAndFetchIdleonSave(){
 const {auth,authModule}=await preloadIdleonPopup();
 const provider=new authModule.GoogleAuthProvider();
 let signedIn=false;
 try{
  const result=await authModule.signInWithPopup(auth,provider);
  signedIn=true;
  const uid=result?.user?.uid;
  if(typeof uid!=="string"||!uid)throw Error("Firebase did not provide an account identifier");
  const token=await result.user.getIdToken();
  // Reading only the signed-in user's own _data document is intentional.
  return await fetchAuthorizedIdleonSave(uid,token,FIREBASE_PROJECT);
 }finally{
  if(signedIn){
   try{await authModule.signOut(auth);}catch{/* No persistence was enabled. */}
  }
 }
}

export const IDLEON_FIREBASE_PROJECT=Object.freeze({projectId:FIREBASE_PROJECT.projectId,
 authDomain:FIREBASE_PROJECT.authDomain});
