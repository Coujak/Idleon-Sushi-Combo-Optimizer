import test from "node:test";
import assert from "node:assert/strict";
import {GOOGLE_DEVICE_VERIFICATION_URL,validateGoogleDeviceAuthorization,
 nextGoogleDevicePoll,createGoogleDeviceFlow} from "../src/google-device-flow.mjs";

const sample=()=>({
 user_code:"ABCD-EFGH",device_code:"confidential-device-code",
 verification_url:GOOGLE_DEVICE_VERIFICATION_URL,
 interval:5,expires_in:1800
});

test("validate device response without changing Google's verification URL",()=>{
 const result=validateGoogleDeviceAuthorization(sample(),1000000);
 assert.deepEqual(result,{
  userCode:"ABCD-EFGH",deviceCode:"confidential-device-code",
  verificationUrl:"https://www.google.com/device",intervalMs:5000,
  expiresAt:2800000
 });
});

test("reject malformed codes and spoofed verification origins",()=>{
 for(const payload of [
  {...sample(),device_code:""},
  {...sample(),expires_in:0},
  {...sample(),interval:0},
  {...sample(),verification_url:"https://google.com.evil.example/device"},
  {...sample(),verification_url:"http://www.google.com/device"},
  {...sample(),verification_url:"https://www.google.com/device/other"}
 ])assert.throws(()=>validateGoogleDeviceAuthorization(payload));
});

test("poll decisions distinguish pending, throttling, refusal, expiration and identity token",()=>{
 const end=300000;
 assert.deepEqual(nextGoogleDevicePoll({error:"authorization_pending"},5000,1000,end),
  {status:"pending",nextIntervalMs:5000});
 assert.deepEqual(nextGoogleDevicePoll({error:"slow_down"},5000,1000,end),
  {status:"pending",nextIntervalMs:10000});
 assert.equal(nextGoogleDevicePoll({error:"access_denied"},5000,1000,end).status,"denied");
 assert.equal(nextGoogleDevicePoll({error:"expired_token"},5000,1000,end).status,"expired");
 assert.equal(nextGoogleDevicePoll({access_token:"wrong-type"},5000,1000,end).status,"failed");
 assert.deepEqual(nextGoogleDevicePoll({id_token:"google-id-token"},5000,1000,end),
  {status:"authorized",idToken:"google-id-token"});
 assert.equal(nextGoogleDevicePoll({id_token:"google-id-token"},5000,end,end).status,"expired");
});

test("Google user code authorizes a Firebase user then reads only their save",async()=>{
 let clock=1_000_000,calls=0,seenDevice=null,seenIdToken=null,seenUser=null;
 const flow=createGoogleDeviceFlow({
  requestDeviceCode:async()=>sample(),
  exchangeDeviceCode:async code=>{
   seenDevice=code;calls++;
   return calls===1?{error:"authorization_pending"}:{id_token:"google-id-token"};
  },
  authenticate:async token=>{seenIdToken=token;return {uid:"authenticated-user"};},
  readCloud:async user=>{seenUser=user;return {Sushi:"[]"};},
  now:()=>clock,
  sleep:async ms=>{clock+=ms;}
 });
 const shown=await flow.start();
 assert.deepEqual(shown,{
  userCode:"ABCD-EFGH",verificationUrl:"https://www.google.com/device",
  expiresAt:2800000,intervalMs:5000
 });
 assert.ok(!Object.values(shown).includes("confidential-device-code"));
 assert.equal(flow.isPending(),true);
 assert.deepEqual(await flow.complete(),{Sushi:"[]"});
 assert.equal(seenDevice,"confidential-device-code");
 assert.equal(seenIdToken,"google-id-token");
 assert.deepEqual(seenUser,{uid:"authenticated-user"});
 assert.equal(calls,2);
 assert.equal(flow.isPending(),false);
});

test("cancel prevents an in-flight poll from exchanging or authenticating",async()=>{
 let resume,exchanges=0;
 const waiting=new Promise(resolve=>{resume=resolve;});
 const flow=createGoogleDeviceFlow({
  requestDeviceCode:async()=>sample(),
  exchangeDeviceCode:async()=>{exchanges++;return {id_token:"token"};},
  authenticate:async()=>{throw Error("should not authenticate");},
  readCloud:async()=>{throw Error("should not read");},
  sleep:()=>waiting
 });
 await flow.start();
 const pending=flow.complete();
 flow.cancel();
 resume();
 assert.equal(await pending,null);
 assert.equal(exchanges,0);
 assert.equal(flow.isPending(),false);
});

test("cannot start device login without authorized broker callbacks",()=>{
 assert.throws(()=>createGoogleDeviceFlow({requestDeviceCode:async()=>sample()}),
  /authorized OAuth broker/);
});
