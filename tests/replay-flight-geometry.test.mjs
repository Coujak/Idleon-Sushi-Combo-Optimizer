import test from "node:test";
import assert from "node:assert/strict";
import {replayFlightGeometry} from "../src/replay-flight-geometry.mjs";

test("Ghost starts exactly on source when replay board has 4px border",()=>{
 const board={left:100,top:200};
 const src={left:119,top:221,width:28,height:28};
 const dst={left:158,top:260,width:28,height:28};
 const flight=replayFlightGeometry(src,dst,board,4,4);
 assert.equal(flight.left,15);
 assert.equal(flight.top,17);
 assert.equal(board.left+4+flight.left,src.left);
 assert.equal(board.top+4+flight.top,src.top);
 assert.equal(flight.dx,39);
 assert.equal(flight.dy,39);
 assert.equal(src.left+flight.dx,dst.left);
 assert.equal(src.top+flight.dy,dst.top);
});
test("Flight aligns centers when fractional tile widths differ",()=>{
 const board={left:25.25,top:49.5};
 const src={left:33.4,top:58.1,width:21.33,height:21.33};
 const dst={left:158.5,top:89.6,width:21.65,height:21.35};
 const geometry=replayFlightGeometry(src,dst,board,4,4);
 const landedX=src.left+src.width/2+geometry.dx;
 const landedY=src.top+src.height/2+geometry.dy;
 assert.ok(Math.abs(landedX-(dst.left+dst.width/2))<1e-9);
 assert.ok(Math.abs(landedY-(dst.top+dst.height/2))<1e-9);
 assert.ok(Math.abs((board.left+4+geometry.left)-src.left)<1e-9);
});
test("Invalid geometry is rejected",()=>{
 assert.throws(()=>replayFlightGeometry(
  {left:0,top:0,width:0,height:20},{left:10,top:0,width:20,height:20},
  {left:0,top:0}),/Invalid/);
});
