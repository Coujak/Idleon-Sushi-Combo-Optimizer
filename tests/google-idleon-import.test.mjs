import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 validateGoogleImportConfig,unpackFirestoreValue,unpackFirestoreFields,
 exchangeGoogleForIdleon,fetchAuthorizedIdleonSave,importGoogleIdleonSave
} from "../src/google-idleon-import.mjs";
import {GOOGLE_IDLEON_CONFIG} from "../src/google-idleon-config.mjs";

const valid={clientId:"1234567890-development.apps.googleusercontent.com",
 firebaseApiKey:"AIzaSySyntheticTestKey0123456789",projectId:"idlemmo"};
const response=(status,data)=>({ok:status>=200&&status<300,status,json:async()=>data});
test("Google/Firebase integration is disabled until explicitly configured",()=>{
 assert.equal(validateGoogleImportConfig(GOOGLE_IDLEON_CONFIG).ready,false);
 assert.equal(validateGoogleImportConfig(valid).ready,true);
 assert.equal(validateGoogleImportConfig({...valid,clientId:""}).ready,false);
 assert.equal(validateGoogleImportConfig({...valid,firebaseApiKey:""}).ready,false);
 assert.equal(validateGoogleImportConfig({...valid,projectId:"../unsafe"}).ready,false);
});
test("Firestore converter restores typed Sushi save without losing huge integers",()=>{
 const unpacked=unpackFirestoreFields({
  Sushi:{stringValue:"[[1,2,3],[0,0,0],[]]"},
  Research:{arrayValue:{values:[{arrayValue:{values:[{integerValue:"42"},{integerValue:"9007199254740995"}]}}]}},
  Active:{booleanValue:true},Extra:{nullValue:null},
  Details:{mapValue:{fields:{mode:{stringValue:"test"}}}}
 });
 assert.equal(unpacked.Sushi,"[[1,2,3],[0,0,0],[]]");
 assert.deepEqual(unpacked.Research,[[42,"9007199254740995"]]);
 assert.equal(unpacked.Active,true);
 assert.equal(unpacked.Extra,null);
 assert.equal(unpacked.Details.mode,"test");
 assert.equal(Object.getPrototypeOf(unpacked),null);
 assert.equal(unpackFirestoreValue({doubleValue:3.5}),3.5);
 assert.equal(Object.hasOwn(unpackFirestoreFields({"__proto__":{stringValue:"unsafe"}}),"__proto__"),false);
});
test("Google access token is exchanged only for short-lived Firebase session credentials",async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  return response(200,{localId:"test-user",idToken:"short-lived-firebase-token",
   refreshToken:"not-copied"});
 };
 const result=await exchangeGoogleForIdleon("google-access-token-for-test-only",valid,fetcher);
 assert.deepEqual(result,{uid:"test-user",idToken:"short-lived-firebase-token"});
 assert.match(calls[0].url,/identitytoolkit\.googleapis\.com\/v1\/accounts:signInWithIdp/);
 const body=JSON.parse(calls[0].options.body);
 assert.equal(body.requestUri,"http://localhost");
 assert.ok(body.postBody.includes("access_token=google-access-token-for-test-only"));
 assert.equal(body.returnSecureToken,true);
 assert.equal(calls[0].options.cache,"no-store");
});
test("Authorized Firebase session loads only its own Firestore save",async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  return response(200,{fields:{Sushi:{stringValue:"[[1,2],[0,0],[]]"}}});
 };
 const save=await fetchAuthorizedIdleonSave("my uid","firebase-test-token",valid,fetcher);
 assert.equal(save.data.Sushi,"[[1,2],[0,0],[]]");
 assert.match(calls[0].url,/\/documents\/_data\/my%20uid$/);
 assert.equal(calls[0].options.headers.Authorization,"Bearer firebase-test-token");
 assert.equal(calls[0].options.cache,"no-store");
});
test("Cloud save flows into the same JSON-compatible parser input",async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  if(calls.length===1)return response(200,{localId:"game-uid",idToken:"firebase-token"});
  return response(200,{fields:{Sushi:{stringValue:"[[1],[0],[0]]"},OptLacc:{arrayValue:{values:[{integerValue:"6"}]}}}});
 };
 const save=await importGoogleIdleonSave("google-token-for-test-only",valid,fetcher);
 assert.equal(save.data.Sushi,"[[1],[0],[0]]");
 assert.deepEqual(save.data.OptLacc,[6]);
 assert.equal(calls.length,2);
});
test("No read is attempted after invalid Firebase credential or denied Firestore access",async()=>{
 let calls=0;
 const rejected=async()=>{calls++;return response(400,{error:{message:"INVALID_IDP_RESPONSE"}});};
 await assert.rejects(importGoogleIdleonSave("google-token-for-test-only",valid,rejected),/OAuth client may not be authorized/);
 assert.equal(calls,1);
 const forbidden=async()=>response(403,{error:{message:"PERMISSION_DENIED"}});
 await assert.rejects(fetchAuthorizedIdleonSave("uid","id-token",valid,forbidden),/did not authorize access/);
 await assert.rejects(fetchAuthorizedIdleonSave("uid","id-token",valid,async()=>response(200,{fields:{Other:{integerValue:"1"}}})),/no readable Sushi Station data/);
});
test("Import UI remains explicit opt-in without credentials or persistent tokens",()=>{
 const ui=readFileSync(new URL("../src/google-idleon-ui.mjs",import.meta.url),"utf8");
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const app=readFileSync(new URL("../src/app.js",import.meta.url),"utf8");
 assert.match(ui,/scope:"openid email profile"/);
 assert.match(ui,/importGoogleIdleonSave\(response\.access_token,config\)/);
 assert.match(ui,/requestAccessToken\(\{prompt:"select_account"\}\)/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|client_secret|refreshToken/);
 assert.match(html,/id="googleIdleonPanel"/);
 assert.match(html,/id="googleIdleonConnect"[^>]*disabled/);
 assert.match(html,/DEV PREVIEW/);
 assert.match(app,/initializeGoogleIdleonUI\(\(data,label\)=>importSave\(data,label\)\)/);
 assert.match(app,/googleImportUI\.clear\(\)/);
});
