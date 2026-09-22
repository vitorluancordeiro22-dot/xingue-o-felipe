const employees=['luan','lucas','joao','vitin','matheus'];

// Seat 0 is the local player. The other five seats are bots in training mode.
// Character choice and round role are separate; never change the lobby selection.
export function createTrainingRound(selectedCharacter:string,random:()=>number=Math.random){
 const felipeSeat=Math.floor(random()*6);
 const hunterRole=felipeSeat===0;
 return {felipeSeat,hunterRole,playerSkin:hunterRole?'felipe':selectedCharacter,
  survivors:employees.filter(id=>hunterRole||id!==selectedCharacter)};
}
