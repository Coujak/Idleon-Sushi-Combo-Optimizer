// Explanation overlays for tested Experimental preparations only.
// These boundaries describe the candidate that actually won the search,
// not the selected optimizer mode (which can reuse earlier candidates).
// Values are zero-based indices into the 100 unlocked, contiguous sushi positions:
// the first engine sushi is at this index; the protected top-tier anchor is index 0.
export const FIRST_ENGINE_INDEX=Object.freeze({
  2:30,3:30,4:30,5:30,6:33,7:31,8:31,9:29,
  10:26,11:24,12:24,13:24
});

export function hasSlotLayoutChanges(currentSlots,recommendedSlots){
  return !Array.isArray(currentSlots)||!Array.isArray(recommendedSlots)||
    currentSlots.length!==recommendedSlots.length||
    currentSlots.some((type,index)=>type!==recommendedSlots[index]);
}

export function getPreparedBoardSections(candidate,slots){
  const match=/^Experimental (\d+)\.0(?:\s|·)/.exec(candidate?.name??"");
  const experiment=match?Number(match[1]):0;
  const firstEngineIndex=FIRST_ENGINE_INDEX[experiment];
  if(!firstEngineIndex||!Array.isArray(candidate?.board)||candidate.board.length!==120||
    !Array.isArray(slots)||slots.length!==120)return null;
  const positions=slots.flatMap((slot,index)=>slot>=0?[index]:[]);
  if(positions.length!==100||positions.some((pos,index)=>index>0&&pos!==positions[index-1]+1))return null;
  const tiers=positions.map(pos=>candidate.board[pos]);
  if(tiers[0]!==64||tiers.some(tier=>!Number.isInteger(tier)||tier<1))return null;
  const sortedSupplies=tiers.slice(1,firstEngineIndex);
  if(sortedSupplies.some((tier,index)=>index>0&&tier>sortedSupplies[index-1]))return null;
  const roles=Array(120).fill(null);
  positions.forEach((pos,index)=>{roles[pos]=index<firstEngineIndex?"supply":"chain";});
  return {
    experiment,
    roles,
    protectedPosition:positions[0],
    firstEnginePosition:positions[firstEngineIndex],
    supplyCount:firstEngineIndex,
    chainCount:positions.length-firstEngineIndex
  };
}


// Trace the outside of an irregular set of board cells as a continuous line.
// Each edge is kept only when its neighboring cell belongs to another section.
// Coordinates follow actual tile boundaries, so the overlay can scale with the grid.
export function preparedSectionOutlinePath(roles,role,x,y,columns=15){
  if(!Array.isArray(roles)||!Array.isArray(x)||!Array.isArray(y)||
      !Number.isInteger(columns)||columns<1||x.length!==columns+1||
      y.length!==Math.ceil(roles.length/columns)+1)return "";
  const edges=[];
  const add=(ax,ay,bx,by)=>edges.push([[ax,ay],[bx,by]]);
  for(let i=0;i<roles.length;i++){
    if(roles[i]!==role)continue;
    const row=Math.floor(i/columns),col=i%columns;
    if(row===0||roles[i-columns]!==role)add(col,row,col+1,row);
    if(col===columns-1||roles[i+1]!==role)add(col+1,row,col+1,row+1);
    if(i+columns>=roles.length||roles[i+columns]!==role)add(col+1,row+1,col,row+1);
    if(col===0||roles[i-1]!==role)add(col,row+1,col,row);
  }
  const outgoing=new Map();
  for(const [a,b] of edges)outgoing.set(a.join(","),b);
  const points=pos=>x[pos[0]].toFixed(1)+" "+y[pos[1]].toFixed(1);
  const paths=[];
  while(outgoing.size){
    const first=outgoing.keys().next().value;
    const start=first.split(",").map(Number);
    let current=start,key=first;
    const commands=["M "+points(start)];
    let steps=0;
    while(outgoing.has(key)&&steps++<=edges.length){
      const next=outgoing.get(key);
      outgoing.delete(key);
      commands.push("L "+points(next));
      current=next;key=current.join(",");
      if(key===first){commands.push("Z");break;}
    }
    paths.push(commands.join(" "));
  }
  return paths.join(" ");
}

// Measure section boundaries from real rendered tile edges, in the SVG's own
// coordinate system. Inner borders sit in the gaps; outer borders hug the tiles.
export function preparedOutlineCoordinates(bounds,svgBounds,columns=15,padding=2){
  if(!Array.isArray(bounds)||!bounds.length||bounds.length%columns!==0||
    !svgBounds||!Number.isInteger(columns)||columns<1||!Number.isFinite(padding))return null;
  const rows=bounds.length/columns;
  const xs=[bounds[0].left-svgBounds.left-padding];
  for(let c=1;c<columns;c++){
    xs.push((bounds[c-1].right+bounds[c].left)/2-svgBounds.left);
  }
  xs.push(bounds[columns-1].right-svgBounds.left+padding);
  const ys=[bounds[0].top-svgBounds.top-padding];
  for(let r=1;r<rows;r++){
    ys.push((bounds[(r-1)*columns].bottom+bounds[r*columns].top)/2-svgBounds.top);
  }
  ys.push(bounds[(rows-1)*columns].bottom-svgBounds.top+padding);
  return {xs,ys};
}
