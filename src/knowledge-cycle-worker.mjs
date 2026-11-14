// Browser-local, cancelable optimizer search. The imported account JSON never
// leaves the user's device; no network requests are made by this worker.
import {optimizeKnowledgeRotation} from "./knowledge-rotation-optimizer.mjs?v=1.0.3";
self.onmessage=event=>{
 try{
  const {save,options}=event.data??{};
  const result=optimizeKnowledgeRotation(save,options);
  self.postMessage({ok:true,result});
 }catch(error){
  self.postMessage({ok:false,error:error?.message??String(error)});
 }
};
