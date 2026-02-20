'use strict';

import * as Config from './../config.js';
import {SpriteBounds} from './spritelib.js';

export let customClipboard;

export function randomRange(min=0.0, max=1.0){
    return Math.random()*(max-min) + min;
}

/**
 * Outputs an easy to read time interval between `date1` and `date2`
 * @param {Date} date 
 */
export function formattedTimeBetweenDates(date1, date2){
    let interval = (date2 - date1)/1000;
    if(interval < 0) interval *= -1;
    let finalInterval = Math.floor(interval);
    if(interval < 60) return finalInterval+(finalInterval == 1 ? ' second' : ' seconds');
    interval /= 60;
    finalInterval = Math.floor(interval);
    if(interval < 60) return finalInterval+(finalInterval == 1 ? ' minute' : ' minutes');
    interval /= 60;
    finalInterval = Math.floor(interval);
    if(interval < 24) return finalInterval+(finalInterval == 1 ? ' hour' : ' hours');
    interval /= 24;
    finalInterval = Math.floor(interval);
    if(interval < 7) return finalInterval+(finalInterval == 1 ? ' day' : ' days');
    finalInterval = Math.floor(interval/7);
    if(interval < 30.4375) return finalInterval+(finalInterval == 1 ? ' week' : ' weeks');
    finalInterval = Math.floor(interval/30.4375);
    if(interval < 365.25) return finalInterval+(finalInterval == 1 ? ' month' : ' months');
    finalInterval = Math.floor(interval/365.25);
    return finalInterval+(finalInterval == 1 ? ' year' : ' years');
}

export function clamp(v, min = 0, max = 1){
    return Math.max(Math.min(v, max), min);
}

let roundDec = 0;
export function round(v, decimals = 0){
    roundDec = Math.pow(10, decimals);
    return Math.floor((v*roundDec)+0.5)/roundDec;
}

export function zoomToCullLevel(zoom){
    if(zoom < 1) return 0;
    if(zoom < 2) return 1;
    if(zoom < 3) return 2;
    if(zoom < 6) return 3;
    if(zoom < 12) return 4;
    if(zoom < 24) return 5;
    if(zoom < 60) return 6;
    return 7;
}

export function lerp(a, b, t){
    return (a * (1-t)) + (b*t);
}

export function mod(a, b){
    return (a % b + b) % b;
}

export function titleCase(text){
    text = text.toString();
    if(text){
        return `${text[0].toUpperCase()}${text.substring(1)}`;
    }
    return '';
}

const uidRegex = /[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}/i;
export function testOwner(query, owner){
    if(!owner || !query) return true;
    if(typeof(query) == 'string'){
        if(uidRegex.test(query)){
            return owner.userId.replaceAll('-','') == query.replaceAll('-', '').toLowerCase();
        }else{
            query = query.toLowerCase();
            return owner.userName.toLowerCase().includes(query) || owner.displayName.toLowerCase().includes(query);
        }
    }else{
        return query.test(owner.userName) || query.test(owner.displayName);
    }
}

const cardinalDirections = [
    'North',
    'Northeast',
    'East',
    'Southeast',
    'South',
    'Southwest',
    'West',
    'Northwest',
]
export function angleToCardinalDirection(angle){
    return cardinalDirections[Math.floor(mod(angle/(2*Math.PI) + (0.5/cardinalDirections.length), 1)*cardinalDirections.length)];
}

/**
 * Check for data-clipboard attributes on an element and its children, then attach an event handler for clicking them to copy that to clipboard.
 * @param {HTMLElement} element 
 */
export function attachClipboardHooks(element){
    let hookList = element.querySelectorAll('[data-clipboard]');
    if(element.dataset.clipboard) hookList.push(element);

    for(let hookTarget of hookList){
        if(!hookTarget.title) hookTarget.title = 'Ctrl+C to copy special';
        hookTarget.style.cursor = 'copy';
        hookTarget.addEventListener('mouseenter', e => {
            customClipboard = hookTarget.dataset.clipboard;
        });
        hookTarget.addEventListener('mouseleave', e => {
            if(customClipboard == hookTarget.dataset.clipboard) customClipboard = null;
        });
        element.removeAttribute('data-clipboard');
    }
}
}