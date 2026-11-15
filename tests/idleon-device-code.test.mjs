import test from "node:test";
import assert from "node:assert/strict";
import {
 DEVICE_CODE_ENDPOINT,DEVICE_TOKEN_ENDPOINT,DEVICE_SCOPES,
 DEVICE_MIN_POLL_MS,validateDeviceOAuthConfig,DeviceAuthError,
 requestGoogleDeviceCode,pollGoogleDeviceToken,awaitGoogleDeviceApproval,waitDevicePoll
} from "../src/idleon-device-code.mjs";

const config={
 clientId:"1010237426756-l184h7psanvrhhss1hk2qcu8690kcj8d.apps.googleusercontent.com",
 clientSecret:"synthetic-secret-only-for-unit-tests"
};
const mock=(status,data)=>({
 ok:status>=200&&status<300,status,json:async()=>data
});
const sample={
 device_code:"mock-device-code-private",user_code:"TEST-CODE",
 verification_url:"https://www.google.com/device",expires_in:1800,interval:5
};

test("Device OAuth requires a correctly formatted registered client and matching secret",async()=>{
 assert.equal(validateDeviceOAuthConfig(config).ready,true);
 assert.equal(validateDeviceOAuthConfig({...config,clientId:""}).ready,false);
 assert.equal(validateDeviceOAuthConfig({...config,clientSecret:""}).ready,false);
 await assert.rejects(requestGoogleDeviceCode({clientId:config.clientId}),{
  name:"DeviceAuthError",code:"not_configured"
 });
});

test("Device authorization requests only basic Google sign-in scopes and validates Google URL",async()=>{
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  return mock(200,sample);
 };
 const result=await requestGoogleDeviceCode(config,{fetcher});
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,DEVICE_CODE_ENDPOINT);
 const body=new URLSearchParams(calls[0].options.body);
 assert.equal(body.get("client_id"),config.clientId);
 assert.equal(body.get("scope"),DEVICE_SCOPES);
 assert.equal(body.has("client_secret"),false);
 assert.equal(calls[0].options.cache,"no-store");
 assert.equal(result.userCode,"TEST-CODE");
 assert.equal(result.verificationUrl,"https://www.google.com/device");
 assert.equal(result.pollIntervalMs,DEVICE_MIN_POLL_MS);
 assert.deepEqual(Object.keys(result).sort(),
  ["userCode","deviceCode","verificationUrl","expiresIn","pollIntervalMs"].sort());
 await assert.rejects(requestGoogleDeviceCode(config,{fetcher:async()=>mock(200,{
  ...sample,verification_url:"https://attacker.example/claim"
 })}),{code:"invalid_response"});
 await assert.rejects(requestGoogleDeviceCode(config,{fetcher:async()=>mock(401,{
  error:"invalid_client"
 })}),{code:"invalid_client"});
});

test("Token poll reports pending, slowdown, and approval without caching refresh tokens",async()=>{
 const calls=[];
 let state=0;
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  if(state++===0)return mock(400,{error:"authorization_pending"});
  if(state===2)return mock(400,{error:"slow_down"});
  return mock(200,{
   id_token:"synthetic-id-token-123456789",
   access_token:"never-saved-access-token",
   refresh_token:"never-saved-refresh-token"
  });
 };
 assert.deepEqual(await pollGoogleDeviceToken(config,"test-device-code",{fetcher}),{status:"pending"});
 assert.deepEqual(await pollGoogleDeviceToken(config,"test-device-code",{fetcher}),{status:"slow_down"});
 assert.deepEqual(await pollGoogleDeviceToken(config,"test-device-code",{fetcher}),
  {status:"authorized",idToken:"synthetic-id-token-123456789"});
 const body=new URLSearchParams(calls[0].options.body);
 assert.ok(calls.every(call=>call.url===DEVICE_TOKEN_ENDPOINT));
 assert.equal(body.get("device_code"),"test-device-code");
 assert.equal(body.get("client_id"),config.clientId);
 assert.equal(body.get("client_secret"),config.clientSecret);
 assert.equal(body.get("grant_type"),"urn:ietf:params:oauth:grant-type:device_code");
});

test("Device polling respects Google intervals, backoff, expiration and cancellation",async()=>{
 let now=1000,waits=[],polls=0;
 const sleep=async ms=>{waits.push(ms);now+=ms;};
 const fetcher=async()=>{
  polls++;
  if(polls===1)return mock(400,{error:"authorization_pending"});
  if(polls===2)return mock(400,{error:"slow_down"});
  return mock(200,{id_token:"synthetic-id-token-123456789"});
 };
 const token=await awaitGoogleDeviceApproval(config,{
  deviceCode:"test-device-code",expiresIn:60,pollIntervalMs:5000
 },{fetcher,sleep,now:()=>now});
 assert.equal(token,"synthetic-id-token-123456789");
 assert.deepEqual(waits,[5000,5000,10000]);

 let expiredNow=0;
 await assert.rejects(awaitGoogleDeviceApproval(config,{
  deviceCode:"test-device-code",expiresIn:6,pollIntervalMs:5000
 },{
  now:()=>expiredNow,
  sleep:async ms=>{expiredNow+=ms;},
  fetcher:async()=>mock(400,{error:"authorization_pending"})
 }),{code:"expired_token"});

 const controller=new AbortController();
 controller.abort();
 await assert.rejects(requestGoogleDeviceCode(config,{
  signal:controller.signal,fetcher:async()=>{throw Error("should not call");}
 }),{code:"cancelled"});
 await assert.rejects(waitDevicePoll(1,controller.signal),{code:"cancelled"});
 await assert.rejects(awaitGoogleDeviceApproval(config,{
  deviceCode:"test-device-code",expiresIn:60,pollIntervalMs:5000
 },{
  signal:controller.signal,fetcher:async()=>{throw Error("should not call");}
 }),{code:"cancelled"});
});

test("Rejected, denied and expired authorization fail closed",async()=>{
 for(const [error,code] of [
  ["access_denied","access_denied"],
  ["expired_token","expired_token"],
  ["invalid_client","invalid_client"]
 ]){
  await assert.rejects(pollGoogleDeviceToken(config,"device",{
   fetcher:async()=>mock(400,{error})
  }),{code});
 }
 await assert.rejects(pollGoogleDeviceToken(config,"device",{
  fetcher:async()=>mock(200,{access_token:"token-without-google-id-token"})
 }),{code:"missing_id_token"});
 assert.ok(DeviceAuthError.prototype instanceof Error);
});
