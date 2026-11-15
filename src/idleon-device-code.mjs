// Google OAuth 2.0 Device Authorization Grant — development-only implementation.
// No client credentials, device codes, or Google tokens are stored or logged.
// A legitimately registered "TVs and Limited Input devices" OAuth client is required.
// See https://developers.google.com/identity/protocols/oauth2/limited-input-device
export const DEVICE_CODE_ENDPOINT="https://oauth2.googleapis.com/device/code";
export const DEVICE_TOKEN_ENDPOINT="https://oauth2.googleapis.com/token";
export const DEVICE_SCOPES="openid email profile";
export const DEVICE_MIN_POLL_MS=5000;

export function validateDeviceOAuthClient(config){
 const clientId=String(config?.clientId??"").trim();
 if(!/^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(clientId))
  return {ready:false,reason:"A registered Google OAuth device client ID is required."};
 return {ready:true,clientId};
}
export function validateDeviceOAuthConfig(config){
 const client=validateDeviceOAuthClient(config);
 if(!client.ready)return client;
 const clientSecret=String(config?.clientSecret??"").trim();
 if(!clientSecret||clientSecret.length<8)
  return {ready:false,reason:"The matching Google device-client secret is required to check approval. Enter it only on this local test page."};
 return {...client,clientSecret};
}

export class DeviceAuthError extends Error{
 constructor(code,message){
  super(message);
  this.name="DeviceAuthError";
  this.code=code;
 }
}

function abortCheck(signal){
 if(signal?.aborted)throw new DeviceAuthError("cancelled","Device authorization was canceled.");
}
async function parseResponse(response){
 try{return await response.json();}catch{
  throw new DeviceAuthError("invalid_response","Google returned an unreadable authorization response.");
 }
}
export function describeDeviceCodeRejection(json,status){
 // Only Google error codes and HTTP status are displayed. Never echo
 // arbitrary descriptions, tokens, credentials, or response bodies.
 const raw=String(json?.error??json?.error_code??"");
 const code=/^[a-z][a-z0-9_]{0,63}$/.test(raw)?raw:"unknown_error";
 const http=Number.isInteger(status)&&status>=400&&status<=599?status:0;
 const details="Google error: "+code+(http?" (HTTP "+http+")":"")+". ";
 const reasons={
  invalid_client:"Google rejected this OAuth client ID. Check that its application type is TVs and Limited Input devices; a Web application client cannot use this endpoint.",
  unauthorized_client:"This OAuth client is not allowed to request device sign-in codes. Check the Google Cloud client type and authorization settings.",
  invalid_scope:"Google rejected the requested scopes. The device client must support Google sign-in scopes.",
  invalid_request:"Google rejected the device-code request. Check the OAuth client's configuration.",
  org_internal:"This OAuth app is restricted to accounts in its organization.",
  rate_limit_exceeded:"Google's device-code request limit was reached. Don't repeatedly retry; try later.",
  access_denied:"Google has denied the device-code request."
 };
 return new DeviceAuthError(code,details+(reasons[code]??"Google rejected this device-code request. Check the Google Cloud OAuth client's application type and settings."));
}

export async function requestGoogleDeviceCode(config,{fetcher=fetch,signal}={}){
 const settings=validateDeviceOAuthClient(config);
 if(!settings.ready)throw new DeviceAuthError("not_configured",settings.reason);
 abortCheck(signal);
 let response,json;
 try{
  response=await fetcher(DEVICE_CODE_ENDPOINT,{
   method:"POST",
   headers:{"Content-Type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({client_id:settings.clientId,scope:DEVICE_SCOPES}).toString(),
   cache:"no-store",signal
  });
  json=await parseResponse(response);
 }catch(error){
  abortCheck(signal);
  if(error instanceof DeviceAuthError)throw error;
  throw new DeviceAuthError("network","Google's device-code service could not be reached.");
 }
 if(!response.ok)throw describeDeviceCodeRejection(json,response.status);
 const userCode=String(json?.user_code??"");
 const deviceCode=String(json?.device_code??"");
 const verificationUrl=String(json?.verification_url??json?.verification_uri??"");
 if(!userCode||!deviceCode||!/^https:\/\/(www\.)?google\.com\/device\/?$/.test(verificationUrl))
  throw new DeviceAuthError("invalid_response","Google returned an invalid device authorization link.");
 const expiresIn=Number(json.expires_in);
 const interval=Number(json.interval);
 if(!Number.isFinite(expiresIn)||expiresIn<30||expiresIn>3600)
  throw new DeviceAuthError("invalid_response","Google returned an invalid device-code expiration.");
 if(!Number.isFinite(interval)||interval<0||interval>3600)
  throw new DeviceAuthError("invalid_response","Google returned an invalid polling interval.");
 return {userCode,deviceCode,verificationUrl,expiresIn,pollIntervalMs:Math.max(DEVICE_MIN_POLL_MS,Math.ceil(interval*1000))};
}

export async function pollGoogleDeviceToken(config,deviceCode,{fetcher=fetch,signal}={}){
 const settings=validateDeviceOAuthConfig(config);
 if(!settings.ready)throw new DeviceAuthError("not_configured",settings.reason);
 if(!deviceCode)throw new DeviceAuthError("invalid_request","Missing Google device authorization code.");
 abortCheck(signal);
 let response,json;
 try{
  response=await fetcher(DEVICE_TOKEN_ENDPOINT,{
   method:"POST",
   headers:{"Content-Type":"application/x-www-form-urlencoded"},
   body:new URLSearchParams({
    client_id:settings.clientId,client_secret:settings.clientSecret,
    device_code:deviceCode,grant_type:"urn:ietf:params:oauth:grant-type:device_code"
   }).toString(),
   cache:"no-store",signal
  });
  json=await parseResponse(response);
 }catch(error){
  abortCheck(signal);
  if(error instanceof DeviceAuthError)throw error;
  throw new DeviceAuthError("network","Unable to check Google's device authorization status.");
 }
 const err=String(json?.error??"");
 if(err==="authorization_pending")return {status:"pending"};
 if(err==="slow_down")return {status:"slow_down"};
 if(err==="access_denied")throw new DeviceAuthError("access_denied","Google authorization was declined.");
 if(err==="expired_token"||err==="invalid_grant")throw new DeviceAuthError("expired_token","The sign-in code expired. Start a new device sign-in.");
 if(err==="invalid_client")throw new DeviceAuthError("invalid_client","Google rejected this OAuth device client. Registration or credentials need checking.");
 if(!response.ok)throw new DeviceAuthError("google_denied","Google couldn't complete device authorization. JSON import is still available.");
 if(typeof json.id_token!=="string"||json.id_token.length<16)
  throw new DeviceAuthError("missing_id_token","Google did not return the ID token needed for Idleon Firebase.");
 // Deliberately discard Google access_token and refresh_token.
 return {status:"authorized",idToken:json.id_token};
}

export function waitDevicePoll(ms,signal){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(new DeviceAuthError("cancelled","Device authorization was canceled."));return;}
  const done=()=>{clearTimeout(timer);signal?.removeEventListener("abort",cancel);};
  const cancel=()=>{done();reject(new DeviceAuthError("cancelled","Device authorization was canceled."));};
  const timer=setTimeout(()=>{done();resolve();},ms);
  signal?.addEventListener("abort",cancel,{once:true});
 });
}

export async function awaitGoogleDeviceApproval(config,device,{
 fetcher=fetch,signal,now=Date.now,sleep=waitDevicePoll,onProgress=()=>{}
}={}){
 const expiry=now()+device.expiresIn*1000;
 let delay=device.pollIntervalMs;
 while(now()<expiry){
  abortCheck(signal);
  const remaining=Math.max(0,expiry-now());
  if(remaining<delay)break;
  onProgress({status:"waiting",remainingMs:remaining,pollIntervalMs:delay});
  await sleep(delay,signal);
  abortCheck(signal);
  if(now()>=expiry)break;
  const result=await pollGoogleDeviceToken(config,device.deviceCode,{fetcher,signal});
  if(result.status==="authorized")return result.idToken;
  if(result.status==="slow_down")delay+=5000;
 }
 throw new DeviceAuthError("expired_token","The Google device code expired. Start a new sign-in.");
}
