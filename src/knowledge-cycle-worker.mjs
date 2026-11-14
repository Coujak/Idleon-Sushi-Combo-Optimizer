// Browser-local, cancelable optimizer search. The imported account JSON never
// leaves the user's device; no network requests are made by this worker.
import {optimizeKnowledgeRotation,continueKnowledgeRotation} from "./knowledge-rotation-optimizer.mjs?v=1.0.16";
self.onmessage=event=>{
 try{
  const {save,options,continuation,waves}=event.data??{};
  const result=continuation?
   continueKnowledgeRotation(save,continuation,waves):
   optimizeKnowledgeRotation(save,options);
  self.postMessage({ok:true,result});
 }catch(error){
  self.postMessage({ok:false,error:error?.message??String(error)});
 }
};
