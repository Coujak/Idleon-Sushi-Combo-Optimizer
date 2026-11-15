import test from "node:test";
import assert from "node:assert/strict";
import {
 CLOUD_SAVE_REFRESH_INTERVAL_MS,
 formatRefreshCountdown,
 startCloudSaveRefresh
} from "../src/idleon-refresh-schedule.mjs";

test("Google cloud save refresh interval and Corgan-style countdown",()=>{
 assert.equal(CLOUD_SAVE_REFRESH_INTERVAL_MS,300000);
 assert.equal(formatRefreshCountdown(300000),"5:00");
 assert.equal(formatRefreshCountdown(299001),"5:00");
 assert.equal(formatRefreshCountdown(299000),"4:59");
 assert.equal(formatRefreshCountdown(61000),"1:01");
 assert.equal(formatRefreshCountdown(0),"0:00");
 assert.equal(formatRefreshCountdown(-1000),"0:00");
});

test("Cloud save refresh schedules one fetch per five minutes and a one-second countdown",()=>{
 let time=1000,counter=0,called=0;
 const intervals=new Map(),cancelled=[];
 const ticks=[];
 const schedule=(callback,delay)=>{
  const id=++counter;
  intervals.set(id,{callback,delay});
  return id;
 };
 const cancel=id=>{cancelled.push(id);intervals.delete(id);};
 const stop=startCloudSaveRefresh(()=>{called++;},{
  schedule,cancel,now:()=>time,onTick:ms=>ticks.push(ms)
 });
 assert.deepEqual([...intervals.values()].map(v=>v.delay),[300000,1000]);
 assert.deepEqual(ticks,[300000]);

 time+=5000;
 [...intervals.values()].find(v=>v.delay===1000).callback();
 assert.equal(ticks.at(-1),295000);
 assert.equal(called,0);

 time+=295000;
 [...intervals.values()].find(v=>v.delay===300000).callback();
 assert.equal(called,1);
 assert.equal(ticks.at(-1),300000);

 stop();
 stop();
 assert.equal(intervals.size,0);
 assert.equal(cancelled.length,2);
});

test("Cloud save refresh cannot tick after pause, sign-out, or Clear",()=>{
 let callback;
 let called=0;
 const active=new Set();
 let id=0;
 const stop=startCloudSaveRefresh(()=>{called++;},{
  schedule:fn=>{callback=fn;active.add(++id);return id;},
  cancel:i=>{active.delete(i);}
 });
 stop();
 callback();
 assert.equal(called,0);
 assert.equal(active.size,0);
 assert.throws(()=>startCloudSaveRefresh(null),TypeError);
});
