import test from "node:test";
import assert from "node:assert/strict";
import {
 STEAM_LOGIN_URL,parseSteamCallback,selectSushiCloudData,
 cloudLoginError,createIdleonCloudClient
} from "../src/idleon-cloud-auth.mjs";

const validCallback=(origin="https://www.legendsofidleon.com/steamsso/")=>{
 const url=new URL(origin);
 url.searchParams.set("openid.claimed_id","https://steamcommunity.com/openid/id/76561198012345678");
 url.searchParams.set("openid.response_nonce","2026-11-12T00:00:00Znonce");
 url.searchParams.set("openid.assoc_handle","test-association");
 url.searchParams.set("openid.sig","base64signed");
 url.searchParams.set("openid.signed","assoc_handle,claimed_id,response_nonce");
 return url.toString();
};

test("Steam sign-in starts on Steam and returns to the official Idleon SSO",()=>{
 const url=new URL(STEAM_LOGIN_URL);
 assert.equal(url.hostname,"steamcommunity.com");
 assert.equal(url.searchParams.get("openid.return_to"),
  "https://www.legendsofidleon.com/steamsso/");
 assert.equal(url.searchParams.get("openid.mode"),"checkid_setup");
});

test("Steam callback only accepts legitimate-shaped official redirect addresses",()=>{
 const result=parseSteamCallback(validCallback());
 assert.deepEqual(result,{
  claimedId:"76561198012345678",nonce:"2026-11-12T00:00:00Znonce",
  assocHandle:"test-association",sig:"base64signed",
  signed:"assoc_handle,claimed_id,response_nonce"
 });
 assert.equal(parseSteamCallback(validCallback().replace(
  "https://www.legendsofidleon.com","https://legendsofidleon.com")).claimedId,
  "76561198012345678");
 for(const value of [
  "https://evil.example/steamsso/?openid.sig=x",
  validCallback().replace("https://www.legendsofidleon.com","http://www.legendsofidleon.com"),
  validCallback().replace("https://www.legendsofidleon.com","https://www.legendsofidleon.com.evil.example"),
  validCallback().replace("steamcommunity.com/openid/id/","steamcommunity.com/other/id/"),
  validCallback().replace("openid.sig=base64signed","openid.sig=")
 ])assert.throws(()=>parseSteamCallback(value));
});

test("Only Sushi-related cloud fields enter the account parser",()=>{
 const full={
  Sushi:"serialized-json",
  Spelunk:[1,2],Menagerie:[3],Research:[4],BundlesReceived:{bon_v:1},
  PlayerUID:"not imported",AccountEmail:"never imported",Guild:"not imported"
 };
 assert.deepEqual(selectSushiCloudData(full),{
  Sushi:"serialized-json",Spelunk:[1,2],Menagerie:[3],Research:[4],
  BundlesReceived:{bon_v:1}
 });
 assert.throws(()=>selectSushiCloudData({}),/no Sushi Station data/);
});

test("Invalid user input and Firebase errors are formatted without leaking callback values",()=>{
 const input=validCallback();
 try{parseSteamCallback("https://not-idleon.example/?code=secret");}
 catch(error){
  const msg=cloudLoginError(error);
  assert.match(msg,/official/);
  assert.ok(!msg.includes("secret"));
 }
 assert.match(cloudLoginError({code:"permission-denied"}),/denied/);
 assert.ok(!cloudLoginError({message:input}).includes(input));
});

test("Steam login fetches only the authorized account save; refresh and disconnect work",async()=>{
 let captured=null,readCount=0,disconnected=0,exchangeCount=0;
 const auth={currentUser:null};
 const load=async()=>({
  auth,
  authTools:{
   signInWithCustomToken:async(_auth,token)=>{
    assert.equal(token,"fake-short-lived-token");
    auth.currentUser={uid:"test-uid"};return {user:auth.currentUser};
   },
   signOut:async()=>{disconnected++;auth.currentUser=null;}
  },
  db:"read-only-db",
  dbTools:{
   doc:(_db,coll,uid)=>{assert.equal(coll,"_data");assert.equal(uid,"test-uid");return "document-ref";},
   getDocFromServer:async ref=>{
    assert.equal(ref,"document-ref");readCount++;
    return {exists:()=>true,data:()=>({Sushi:"[]",UnrelatedPrivateField:"secret"})};
   }
  }
 });
 const exchange=async signed=>{captured=signed;exchangeCount++;return "fake-short-lived-token";};
 const cloud=createIdleonCloudClient({load,exchange});
 assert.equal(cloud.isConnected(),false);
 await assert.rejects(()=>cloud.connectSteam("https://evil.example"));
 assert.equal(exchangeCount,0);
 assert.deepEqual(await cloud.connectSteam(validCallback()),{Sushi:"[]"});
 assert.equal(captured.claimedId,"76561198012345678");
 assert.equal(readCount,1);
 assert.equal(cloud.isConnected(),true);
 assert.deepEqual(await cloud.refresh(),{Sushi:"[]"});
 assert.equal(readCount,2);
 await cloud.disconnect();
 assert.equal(disconnected,1);
 assert.equal(cloud.isConnected(),false);
 await assert.rejects(()=>cloud.refresh(),/Connect your Idleon account/);
});
