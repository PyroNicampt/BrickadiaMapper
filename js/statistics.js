'use strict';

let stats = {};
let users = {};
export let show = true;

export function addUser(userId, data){
    if(!userId) return;
    users[userId] = data;
}

export function addCountForUser(userId, amount){
    if(!userId) return;
    stats[userId] = (stats[userId] ?? 0) + (amount ?? 1);
    if(stats[userId] <= 0) delete stats[userId];
}

export function resetCounts(){
    stats = {};
}

export function getStats(){
    let output = [];
    for(let userId in stats){
        output.push({
            displayName: users[userId].displayName,
            userName: users[userId].userName,
            userId: userId,
            count: stats[userId],
        });
    }
    output.sort((a, b) => b.count - a.count);
    return output;
}

export function showStats(state = true){
    show = state;
}