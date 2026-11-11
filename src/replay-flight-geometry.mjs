// Translate viewport tile rectangles into an absolutely positioned
// clone inside the replay board's padding edge (excluding its border).
// Center-to-center delta handles fractional responsive-grid cell sizes.
export function replayFlightGeometry(sourceRect,destinationRect,boardRect,
 boardBorderLeft=0,boardBorderTop=0){
 const numbers=[sourceRect.left,sourceRect.top,sourceRect.width,sourceRect.height,
  destinationRect.left,destinationRect.top,destinationRect.width,
  destinationRect.height,boardRect.left,boardRect.top,boardBorderLeft,boardBorderTop];
 if(numbers.some(value=>!Number.isFinite(value))||
  sourceRect.width<=0||sourceRect.height<=0||
  destinationRect.width<=0||destinationRect.height<=0||
  boardBorderLeft<0||boardBorderTop<0)
  throw Error("Invalid Sushi Station replay geometry");
 return {
  left:sourceRect.left-boardRect.left-boardBorderLeft,
  top:sourceRect.top-boardRect.top-boardBorderTop,
  width:sourceRect.width,height:sourceRect.height,
  dx:(destinationRect.left+destinationRect.width/2)-
     (sourceRect.left+sourceRect.width/2),
  dy:(destinationRect.top+destinationRect.height/2)-
     (sourceRect.top+sourceRect.height/2)
 };
}
