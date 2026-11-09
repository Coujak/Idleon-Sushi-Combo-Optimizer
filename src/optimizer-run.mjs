// The UI can interrupt searches at any asynchronous checkpoint.
export function throwIfCancelled(signal){
  if(signal?.aborted){
    const error=new Error("Optimization cancelled");
    error.name="AbortError";
    throw error;
  }
}
export async function yieldToUI(signal){
  throwIfCancelled(signal);
  await new Promise(resolve=>setTimeout(resolve,0));
  throwIfCancelled(signal);
}
